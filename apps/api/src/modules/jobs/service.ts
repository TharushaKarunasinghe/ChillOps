import {
  canRecordJobEvent,
  createJobSchema,
  jobIdSchema,
  listJobsResponseSchema,
  jobResponseSchema,
  customerOptionsSchema,
  branchOptionsSchema,
  equipmentOptionsSchema,
  type CreateJob,
  type ListJobsQuery,
  type JobsErrorBody,
} from '@chillops/shared/jobs';
import type { JobsRepository } from './repository.ts';
export class JobsError extends Error {
  readonly status: 422 | 404;
  readonly body: JobsErrorBody;
  constructor(status: 422 | 404, body: JobsErrorBody) {
    super(body.error);
    this.status = status;
    this.body = body;
  }
}
export class JobsService {
  private readonly repository: JobsRepository;
  constructor(repository: JobsRepository) {
    this.repository = repository;
  }
  async list(query: ListJobsQuery) {
    return listJobsResponseSchema.parse(await this.repository.list(query));
  }
  async detail(id: string) {
    if (!jobIdSchema.safeParse({ id }).success)
      throw new JobsError(422, {
        error: 'Invalid job ID.',
        fields: { id: ['Enter a valid UUID.'] },
      });
    const job = await this.repository.detail(id);
    if (!job) throw new JobsError(404, { error: 'Job not found.' });
    return jobResponseSchema.parse({ job });
  }
  async create(input: CreateJob, actorId: string) {
    const parsed = createJobSchema.parse(input);
    if (!canRecordJobEvent(null, 'unassigned'))
      throw new Error('Invalid initial event.');
    const result = await this.repository.create(parsed, actorId);
    if (result.error_field) {
      const messages = {
        customer_id: 'Select an existing customer.',
        branch_id: 'Select a branch belonging to this customer.',
        equipment_id: 'Select equipment belonging to this branch.',
      };
      const message = messages[result.error_field];
      throw new JobsError(422, {
        error: message,
        fields: { [result.error_field]: [message] },
      });
    }
    return jobResponseSchema.parse({ job: result.job });
  }
  async customers() {
    return customerOptionsSchema.parse(await this.repository.customers());
  }
  async branches(id: string) {
    return branchOptionsSchema.parse(await this.repository.branches(id));
  }
  async equipment(id: string) {
    return equipmentOptionsSchema.parse(await this.repository.equipment(id));
  }
}
