import type { Hono, Context } from 'hono';
import type { z } from '@chillops/shared/jobs';
import {
  listJobsQuerySchema,
  jobIdSchema,
  createJobSchema,
  customerLookupQuerySchema,
  branchLookupQuerySchema,
  equipmentLookupQuerySchema,
  jobsErrorSchema,
} from '@chillops/shared/jobs';
import { requireRole, type AuthEnv } from '../auth/middleware.ts';
import { JobsError, JobsService } from './service.ts';
import { createJobsRepository } from './neon-repository.ts';

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fields: Record<string, string[]> = {};
  for (const issue of result.error.issues)
    (fields[String(issue.path[0] ?? 'request')] ??= []).push(issue.message);
  throw new JobsError(422, { error: 'Check the highlighted fields.', fields });
}
export function registerJobsRoutes(app: Hono<AuthEnv>, injected?: JobsService) {
  const service = (c: Context<AuthEnv>) => {
    if (injected) return injected;
    if (!c.env?.DATABASE_URL) throw new Error('Database unavailable.');
    return new JobsService(createJobsRepository(c.env.DATABASE_URL));
  };
  // Keep jobs failures separate from auth failures and never expose driver messages.
  const handle =
    (action: (c: Context<AuthEnv>) => Promise<Response>) =>
    async (c: Context<AuthEnv>) => {
      try {
        return await action(c);
      } catch (error) {
        if (error instanceof JobsError)
          return c.json(jobsErrorSchema.parse(error.body), error.status);
        return c.json(
          jobsErrorSchema.parse({
            error: 'Jobs service is unavailable. Try again later.',
          }),
          503,
        );
      }
    };
  app.get(
    '/api/jobs',
    requireRole('ops', 'director'),
    handle(async (c) =>
      c.json(await service(c).list(parse(listJobsQuerySchema, c.req.query()))),
    ),
  );
  app.get(
    '/api/jobs/:id',
    requireRole('ops', 'director'),
    handle(async (c) => {
      const { id } = parse(jobIdSchema, c.req.param());
      return c.json(await service(c).detail(id));
    }),
  );
  app.post(
    '/api/jobs',
    requireRole('ops'),
    handle(async (c) => {
      const input = parse(
        createJobSchema,
        await c.req.json().catch(() => null),
      );
      const result = await service(c).create(input, c.get('session').user.id);
      c.header('Location', `/api/jobs/${result.job.id}`);
      return c.json(result, 201);
    }),
  );
  app.get(
    '/api/lookups/customers',
    requireRole('ops'),
    handle(async (c) => {
      parse(customerLookupQuerySchema, c.req.query());
      return c.json(await service(c).customers());
    }),
  );
  app.get(
    '/api/lookups/branches',
    requireRole('ops'),
    handle(async (c) => {
      const q = parse(branchLookupQuerySchema, c.req.query());
      return c.json(await service(c).branches(q.customer_id));
    }),
  );
  app.get(
    '/api/lookups/equipment',
    requireRole('ops'),
    handle(async (c) => {
      const q = parse(equipmentLookupQuerySchema, c.req.query());
      return c.json(await service(c).equipment(q.branch_id));
    }),
  );
}
