import { describe, expect, it } from 'vitest';
import { JobsService } from './service.ts';
import { TestJobsRepository, testInput, testJob } from './test-repository.ts';
const other = '00000000-0000-4000-8000-000000000999';
describe('jobs service with an atomic fake repository', () => {
  it('lists filtered jobs in priority and time order, with correct empty-page totals', async () => {
    const repo = new TestJobsRepository();
    repo.jobs = [
      { ...testJob, id: other, priority: 'routine' },
      {
        ...testJob,
        id: '00000000-0000-4000-8000-000000000998',
        priority: 'critical',
        reported_at: '2026-11-21T10:00:00.000Z',
      },
      { ...testJob, priority: 'critical' },
    ];
    const service = new JobsService(repo);
    expect(
      (await service.list({ page: 1, page_size: 25 })).items.map((j) => j.id),
    ).toEqual([testJob.id, '00000000-0000-4000-8000-000000000998', other]);
    expect(await service.list({ page: 5, page_size: 2 })).toEqual({
      items: [],
      page: 5,
      page_size: 2,
      total: 3,
      total_pages: 2,
    });
    expect(
      (await service.list({ page: 1, page_size: 25, status: ['pending'] }))
        .total,
    ).toBe(0);
    for (const filter of [
      { priority: 'urgent' as const },
      { job_type: 'planned_service' as const },
      { customer_id: other },
      { branch_id: other },
    ])
      expect(
        (await service.list({ page: 1, page_size: 25, ...filter })).items,
      ).toEqual([]);
  });
  it('returns detail and safe 404/422 errors', async () => {
    const service = new JobsService(new TestJobsRepository());
    expect((await service.detail(testJob.id)).job.events).toEqual(
      testJob.events,
    );
    await expect(service.detail(other)).rejects.toMatchObject({ status: 404 });
    await expect(service.detail('not-a-uuid')).rejects.toMatchObject({
      status: 422,
    });
  });
  it('creates one manual job with an initial event and audit', async () => {
    const repo = new TestJobsRepository();
    const service = new JobsService(repo);
    const result = await service.create(testInput, testJob.created_by!.id);
    expect(result.job).toMatchObject({
      source: 'manual',
      current_status: 'unassigned',
      created_by: testJob.created_by,
    });
    expect(result.job.events).toHaveLength(1);
    expect(result.job.events[0]).toMatchObject({
      from_status: null,
      to_status: 'unassigned',
      actor: testJob.created_by,
    });
    expect(repo.jobs).toHaveLength(2);
    expect(repo.audits).toEqual([result.job.id]);
  });
  for (const field of ['customer_id', 'branch_id', 'equipment_id'] as const)
    it(`maps ${field} ownership failure without saving`, async () => {
      const repo = new TestJobsRepository();
      const service = new JobsService(repo);
      await expect(
        service.create(
          { ...testInput, [field]: other },
          testJob.created_by!.id,
        ),
      ).rejects.toMatchObject({
        status: 422,
        body: { fields: { [field]: expect.any(Array) } },
      });
      expect(repo.jobs).toHaveLength(1);
      expect(repo.audits).toEqual([]);
    });
  for (const failAt of ['event', 'audit'] as const)
    it(`saves nothing if ${failAt} insertion fails`, async () => {
      const repo = new TestJobsRepository();
      repo.failAt = failAt;
      await expect(
        new JobsService(repo).create(testInput, testJob.created_by!.id),
      ).rejects.toThrow();
      expect(repo.jobs).toEqual([testJob]);
      expect(repo.audits).toEqual([]);
    });
  it('rejects malformed repository responses', async () => {
    const repo = new TestJobsRepository();
    repo.jobs[0]!.job_number = 'invalid';
    await expect(new JobsService(repo).detail(testJob.id)).rejects.toThrow();
  });
});
