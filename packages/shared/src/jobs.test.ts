import { describe, expect, it } from 'vitest';
import { JOB_STATUSES } from './index';
import {
  canTransition,
  canRecordJobEvent,
  priorityRank,
  jobAgeMinutes,
  listJobsQuerySchema,
  createJobSchema,
} from './jobs';

describe('job rules', () => {
  const valid = new Set([
    'unassigned:assigned',
    'assigned:in_transit',
    'in_transit:on_site',
    'on_site:completed',
    'on_site:pending',
    'pending:assigned',
  ]);
  for (const from of JOB_STATUSES)
    for (const to of JOB_STATUSES)
      it(`${from} to ${to}`, () => {
        expect(canTransition(from, to)).toBe(valid.has(`${from}:${to}`));
      });
  it('permits only unassigned as the initial event', () => {
    for (const to of JOB_STATUSES)
      expect(canRecordJobEvent(null, to)).toBe(to === 'unassigned');
  });
  it('orders priority explicitly', () => {
    expect(
      ['routine', 'critical', 'urgent'].sort(
        (a, b) => priorityRank(a as 'routine') - priorityRank(b as 'routine'),
      ),
    ).toEqual(['critical', 'urgent', 'routine']);
  });
  it('calculates elapsed full minutes with an explicit clock', () => {
    expect(
      jobAgeMinutes('2026-01-01T00:00:00Z', Date.parse('2026-01-02T01:01:59Z')),
    ).toBe(1501);
    expect(
      jobAgeMinutes('2026-01-02T00:00:00Z', Date.parse('2026-01-01T00:00:00Z')),
    ).toBe(0);
    expect(() => jobAgeMinutes('invalid', 0)).toThrow();
  });
  it('validates bounded pagination, enums, UUIDs and strict create fields', () => {
    expect(listJobsQuerySchema.parse({})).toMatchObject({
      page: 1,
      page_size: 25,
    });
    expect(
      listJobsQuerySchema.parse({ status: 'unassigned,pending' }).status,
    ).toEqual(['unassigned', 'pending']);
    for (const query of [
      { page_size: '101' },
      { page: '0' },
      { page: '1.5' },
      { status: 'invalid' },
      { customer_id: 'wrong' },
      { sort: 'anything' },
    ])
      expect(listJobsQuerySchema.safeParse(query).success).toBe(false);
    const body = {
      customer_id: '00000000-0000-4000-8000-000000000001',
      branch_id: '00000000-0000-4000-8000-000000000002',
      job_type: 'breakdown',
      priority: 'urgent',
      description: 'Cooling loss',
    };
    expect(createJobSchema.safeParse(body).success).toBe(true);
    expect(
      createJobSchema.safeParse({ ...body, current_status: 'completed' })
        .success,
    ).toBe(false);
    expect(
      createJobSchema.safeParse({ ...body, description: ' ' }).success,
    ).toBe(false);
  });
});
