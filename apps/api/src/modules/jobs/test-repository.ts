import {
  priorityRank,
  type JobDetail,
  type CreateJob,
  type ListJobsQuery,
} from '@chillops/shared/jobs';
import { generateSeed } from '../../seed/data.ts';
import type { JobsRepository, CreateResult } from './repository.ts';
const seed = generateSeed(new Date('2026-11-20T10:00:00Z'));
export const testJob: JobDetail = {
  id: '00000000-0000-4000-8000-000000000100',
  job_number: 'JOB-1001',
  customer: { id: seed.customers[0]!.id, name: 'Frostfern Markets' },
  branch: {
    id: seed.branches[0]!.id,
    name: 'Lantern Quay',
    address: 'Colombo',
    latitude: 6.93,
    longitude: 79.85,
  },
  equipment: {
    id: seed.equipment[0]!.id,
    type: 'refrigeration',
    label: 'Display chiller 1',
    model: null,
    serial_number: null,
  },
  job_type: 'breakdown',
  priority: 'urgent',
  current_status: 'unassigned',
  reported_at: '2026-11-20T10:00:00.000Z',
  description: 'Synthetic cooling fault',
  source: 'manual',
  created_by: {
    id: '00000000-0000-4000-8000-000000000001',
    full_name: 'Fictional Operator',
  },
  created_at: '2026-11-20T10:00:00.000Z',
  updated_at: '2026-11-20T10:00:00.000Z',
  events: [
    {
      id: '00000000-0000-4000-8000-000000000101',
      from_status: null,
      to_status: 'unassigned',
      actor: {
        id: '00000000-0000-4000-8000-000000000001',
        full_name: 'Fictional Operator',
      },
      occurred_at: '2026-11-20T10:00:00.000Z',
      latitude: null,
      longitude: null,
      reason: null,
      note: null,
    },
  ],
};
export const testInput: CreateJob = {
  customer_id: testJob.customer.id,
  branch_id: testJob.branch.id,
  equipment_id: testJob.equipment!.id,
  job_type: 'breakdown',
  priority: 'urgent',
  description: 'Synthetic cooling fault',
};
export class TestJobsRepository implements JobsRepository {
  jobs: JobDetail[] = [structuredClone(testJob)];
  audits: string[] = [];
  failAt: 'event' | 'audit' | null = null;
  async list(q: ListJobsQuery) {
    const filtered = this.jobs
      .filter(
        (j) =>
          (!q.status || q.status.includes(j.current_status)) &&
          (!q.priority || j.priority === q.priority) &&
          (!q.job_type || j.job_type === q.job_type) &&
          (!q.customer_id || j.customer.id === q.customer_id) &&
          (!q.branch_id || j.branch.id === q.branch_id),
      )
      .sort(
        (a, b) =>
          priorityRank(a.priority) - priorityRank(b.priority) ||
          a.reported_at.localeCompare(b.reported_at) ||
          a.id.localeCompare(b.id),
      );
    return {
      items: filtered
        .slice((q.page - 1) * q.page_size, q.page * q.page_size)
        .map((j) => ({
          id: j.id,
          job_number: j.job_number,
          customer: j.customer,
          branch: { id: j.branch.id, name: j.branch.name },
          job_type: j.job_type,
          priority: j.priority,
          current_status: j.current_status,
          reported_at: j.reported_at,
        })),
      page: q.page,
      page_size: q.page_size,
      total: filtered.length,
      total_pages: Math.ceil(filtered.length / q.page_size),
    };
  }
  async detail(id: string) {
    return this.jobs.find((j) => j.id === id) ?? null;
  }
  async create(input: CreateJob, actorId: string): Promise<CreateResult> {
    if (input.customer_id !== testJob.customer.id)
      return { error_field: 'customer_id', job: null };
    if (input.branch_id !== testJob.branch.id)
      return { error_field: 'branch_id', job: null };
    if (
      input.equipment_id !== null &&
      input.equipment_id !== testJob.equipment!.id
    )
      return { error_field: 'equipment_id', job: null };
    const job: JobDetail = {
      ...structuredClone(testJob),
      id: crypto.randomUUID(),
      job_number: 'JOB-2001',
      description: input.description,
      job_type: input.job_type,
      priority: input.priority,
      equipment: input.equipment_id ? testJob.equipment : null,
      created_by: { id: actorId, full_name: 'Fictional Operator' },
    };
    job.events[0]!.actor = job.created_by;
    if (this.failAt === 'event' || this.failAt === 'audit')
      throw new Error('Synthetic atomic insert failure');
    this.jobs.push(job);
    this.audits.push(job.id);
    return { error_field: null, job };
  }
  async customers() {
    return { items: [testJob.customer] };
  }
  async branches(id: string) {
    return {
      items:
        id === testJob.customer.id
          ? [
              {
                id: testJob.branch.id,
                name: testJob.branch.name,
                customer_id: id,
              },
            ]
          : [],
    };
  }
  async equipment(id: string) {
    return {
      items:
        id === testJob.branch.id
          ? [
              {
                id: testJob.equipment!.id,
                label: testJob.equipment!.label,
                type: testJob.equipment!.type,
                branch_id: id,
              },
            ]
          : [],
    };
  }
}
