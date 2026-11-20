import {
  jobsErrorSchema,
  type z,
  type JobsErrorBody,
} from '@chillops/shared/jobs';
export class JobsApiError extends Error {
  readonly status: number;
  readonly fields: JobsErrorBody['fields'];
  constructor(status: number, body: JobsErrorBody) {
    super(body.error);
    this.status = status;
    this.fields = body.fields;
  }
}
export async function jobsRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...options, credentials: 'same-origin' });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new Error('Unable to reach the jobs service. Try again.');
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = jobsErrorSchema.safeParse(body);
    throw new JobsApiError(
      response.status,
      parsed.success
        ? parsed.data
        : { error: 'Jobs service is unavailable. Try again later.' },
    );
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success)
    throw new Error(
      'The jobs service returned an invalid response. Try again.',
    );
  return parsed.data;
}
