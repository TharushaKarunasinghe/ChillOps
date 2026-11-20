import { z } from 'zod';
export type { z } from 'zod';
import { JOB_STATUSES, type JobStatus } from '@chillops/shared';

export const JOB_PRIORITIES = ['critical', 'urgent', 'routine'] as const;
export const JOB_TYPES = ['breakdown', 'planned_service'] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];
const transitions: Record<JobStatus, readonly JobStatus[]> = {
  unassigned: ['assigned'],
  assigned: ['in_transit'],
  in_transit: ['on_site'],
  on_site: ['completed', 'pending'],
  completed: [],
  pending: ['assigned'],
};
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return transitions[from].includes(to);
}
export function canRecordJobEvent(
  from: JobStatus | null,
  to: JobStatus,
): boolean {
  return from === null ? to === 'unassigned' : canTransition(from, to);
}
export function priorityRank(priority: JobPriority): number {
  return { critical: 1, urgent: 2, routine: 3 }[priority];
}
export function jobAgeMinutes(reportedAt: string, now: number): number {
  const reported = Date.parse(reportedAt);
  if (!Number.isFinite(reported) || !Number.isFinite(now))
    throw new Error('Invalid job age date.');
  return Math.max(0, Math.floor((now - reported) / 60000));
}
const uuid = z.uuid();
const timestamp = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value).toISOString());
const status = z.enum(JOB_STATUSES);
const priority = z.enum(JOB_PRIORITIES);
const jobType = z.enum(JOB_TYPES);
const pageNumber = z.coerce.number().int().min(1).max(1_000_000);
export const listJobsQuerySchema = z.strictObject({
  status: z
    .string()
    .transform((s) => s.split(','))
    .pipe(z.array(status).min(1).max(6))
    .optional(),
  priority: priority.optional(),
  job_type: jobType.optional(),
  customer_id: uuid.optional(),
  branch_id: uuid.optional(),
  page: pageNumber.default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListJobsQuery = z.infer<typeof listJobsQuerySchema>;
export const jobIdSchema = z.strictObject({ id: uuid });
export const customerLookupQuerySchema = z.strictObject({});
export const branchLookupQuerySchema = z.strictObject({ customer_id: uuid });
export const equipmentLookupQuerySchema = z.strictObject({ branch_id: uuid });
export const createJobSchema = z.strictObject({
  customer_id: uuid,
  branch_id: uuid,
  equipment_id: uuid.nullable().optional().default(null),
  job_type: jobType,
  priority,
  description: z.string().trim().min(1).max(4000),
});
export type CreateJob = z.infer<typeof createJobSchema>;
const named = z.strictObject({ id: uuid, name: z.string() });
const actor = z.strictObject({ id: uuid, full_name: z.string() }).nullable();
export const jobSummarySchema = z.strictObject({
  id: uuid,
  job_number: z.string().regex(/^JOB-\d+$/),
  customer: named,
  branch: named,
  job_type: jobType,
  priority,
  current_status: status,
  reported_at: timestamp,
});
export const eventSchema = z.strictObject({
  id: uuid,
  from_status: status.nullable(),
  to_status: status,
  actor,
  occurred_at: timestamp,
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  reason: z.string().nullable(),
  note: z.string().nullable(),
});
export const jobDetailSchema = jobSummarySchema.extend({
  branch: named.extend({
    address: z.string(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
  }),
  equipment: z
    .strictObject({
      id: uuid,
      type: z.enum(['refrigeration', 'air_conditioning', 'other']),
      label: z.string(),
      model: z.string().nullable(),
      serial_number: z.string().nullable(),
    })
    .nullable(),
  description: z.string(),
  source: z.enum(['email', 'manual']),
  created_by: actor,
  created_at: timestamp,
  updated_at: timestamp,
  events: z.array(eventSchema),
});
export type JobSummary = z.infer<typeof jobSummarySchema>;
export type JobDetail = z.infer<typeof jobDetailSchema>;
export const listJobsResponseSchema = z.strictObject({
  items: z.array(jobSummarySchema),
  page: pageNumber,
  page_size: z.number().int().min(1).max(100),
  total: z.number().int().nonnegative(),
  total_pages: z.number().int().nonnegative(),
});
export type ListJobsResponse = z.infer<typeof listJobsResponseSchema>;
export const jobResponseSchema = z.strictObject({ job: jobDetailSchema });
export const customerOptionsSchema = z.strictObject({ items: z.array(named) });
export const branchOptionsSchema = z.strictObject({
  items: z.array(named.extend({ customer_id: uuid })),
});
export const equipmentOptionsSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      id: uuid,
      branch_id: uuid,
      label: z.string(),
      type: z.enum(['refrigeration', 'air_conditioning', 'other']),
    }),
  ),
});
export const jobsErrorSchema = z.strictObject({
  error: z.string(),
  fields: z.record(z.string(), z.array(z.string())).optional(),
});
export type JobsErrorBody = z.infer<typeof jobsErrorSchema>;
