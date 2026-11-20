import type { z } from '@chillops/shared/jobs';
import type {
  CreateJob,
  JobDetail,
  ListJobsQuery,
  ListJobsResponse,
  customerOptionsSchema,
  branchOptionsSchema,
  equipmentOptionsSchema,
} from '@chillops/shared/jobs';
export type OwnershipField = 'customer_id' | 'branch_id' | 'equipment_id';
export type CreateResult =
  | { error_field: OwnershipField; job: null }
  | { error_field: null; job: JobDetail };
export interface JobsRepository {
  list(query: ListJobsQuery): Promise<ListJobsResponse>;
  detail(id: string): Promise<JobDetail | null>;
  create(input: CreateJob, actorId: string): Promise<CreateResult>;
  customers(): Promise<z.infer<typeof customerOptionsSchema>>;
  branches(customerId: string): Promise<z.infer<typeof branchOptionsSchema>>;
  equipment(branchId: string): Promise<z.infer<typeof equipmentOptionsSchema>>;
}
