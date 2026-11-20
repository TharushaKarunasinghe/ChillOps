import { sql } from 'drizzle-orm';
import {
  jobDetailSchema,
  listJobsResponseSchema,
  customerOptionsSchema,
  branchOptionsSchema,
  equipmentOptionsSchema,
  type ListJobsQuery,
} from '@chillops/shared/jobs';
import { createDatabase } from '../../db/client';
import type { JobsRepository } from './repository.ts';
import { createJobStatement } from './create-statement.ts';

const summary = sql`jsonb_build_object('id',j.id,'job_number',j.job_number,
  'customer',jsonb_build_object('id',c.id,'name',c.name),
  'branch',jsonb_build_object('id',b.id,'name',b.name),
  'job_type',j.job_type,'priority',j.priority,'current_status',j.current_status,'reported_at',j.reported_at)`;
export function listJobsStatement(q: ListJobsQuery) {
  const predicates = [sql`true`];
  if (q.status)
    predicates.push(
      sql`j.current_status IN (${sql.join(
        q.status.map((s) => sql`${s}::job_status`),
        sql`, `,
      )})`,
    );
  if (q.priority)
    predicates.push(sql`j.priority = ${q.priority}::job_priority`);
  if (q.job_type) predicates.push(sql`j.job_type = ${q.job_type}::job_type`);
  if (q.customer_id)
    predicates.push(sql`j.customer_id = ${q.customer_id}::uuid`);
  if (q.branch_id) predicates.push(sql`j.branch_id = ${q.branch_id}::uuid`);
  return sql`WITH filtered AS MATERIALIZED (
    SELECT ${summary} AS item, count(*) OVER() AS total,
      CASE j.priority WHEN 'critical' THEN 1 WHEN 'urgent' THEN 2 WHEN 'routine' THEN 3 END AS priority_order,
      j.reported_at, j.id
    FROM jobs j JOIN customers c ON c.id=j.customer_id JOIN branches b ON b.id=j.branch_id
    WHERE ${sql.join(predicates, sql` AND `)}
  ), page AS (
    SELECT * FROM filtered ORDER BY priority_order,reported_at,id
    LIMIT ${q.page_size} OFFSET ${(q.page - 1) * q.page_size}
  ) SELECT coalesce((SELECT jsonb_agg(item ORDER BY priority_order,reported_at,id) FROM page),'[]'::jsonb) AS items,
    coalesce((SELECT total FROM filtered LIMIT 1),0)::integer AS total`;
}
export function createJobsRepository(url: string): JobsRepository {
  const db = createDatabase(url);
  return {
    async list(query) {
      const result = await db.execute(listJobsStatement(query));
      const row = result.rows[0]!;
      return listJobsResponseSchema.parse({
        ...row,
        page: query.page,
        page_size: query.page_size,
        total_pages: Math.ceil(Number(row.total) / query.page_size),
      });
    },
    async detail(id) {
      const result =
        await db.execute(sql`SELECT ${summary} || jsonb_build_object(
        'branch',jsonb_build_object('id',b.id,'name',b.name,'address',b.address,'latitude',b.latitude,'longitude',b.longitude),
        'equipment',CASE WHEN e.id IS NULL THEN NULL ELSE jsonb_build_object('id',e.id,'type',e.type,'label',e.label,'model',e.model,'serial_number',e.serial_number) END,
        'description',j.description,'source',j.source,'created_at',j.created_at,'updated_at',j.updated_at,
        'created_by',CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id',u.id,'full_name',u.full_name) END,
        'events',coalesce((SELECT jsonb_agg(jsonb_build_object('id',v.id,'from_status',v.from_status,'to_status',v.to_status,
          'actor',CASE WHEN a.id IS NULL THEN NULL ELSE jsonb_build_object('id',a.id,'full_name',a.full_name) END,
          'occurred_at',v.occurred_at,'latitude',v.latitude,'longitude',v.longitude,'reason',v.reason,'note',v.note)
          ORDER BY v.occurred_at,v.created_at,v.id) FROM job_events v LEFT JOIN users a ON a.id=v.actor_id WHERE v.job_id=j.id),'[]'::jsonb)
        ) AS job FROM jobs j JOIN customers c ON c.id=j.customer_id JOIN branches b ON b.id=j.branch_id
        LEFT JOIN equipment e ON e.id=j.equipment_id LEFT JOIN users u ON u.id=j.created_by WHERE j.id=${id}::uuid`);
      return result.rows[0] ? jobDetailSchema.parse(result.rows[0].job) : null;
    },
    async create(input, actorId) {
      const result = await db.execute(createJobStatement(input, actorId));
      const row = result.rows[0]!;
      if (
        row.error_field === 'customer_id' ||
        row.error_field === 'branch_id' ||
        row.error_field === 'equipment_id'
      )
        return { error_field: row.error_field, job: null };
      if (!row.job || !row.initial_event || !row.audit_id)
        throw new Error('Incomplete creation result.');
      const job = row.job as Record<string, unknown>;
      const event = row.initial_event as Record<string, unknown>;
      return {
        error_field: null,
        job: jobDetailSchema.parse({
          id: job.id,
          job_number: job.job_number,
          customer: row.customer,
          branch: row.branch,
          equipment: row.equipment,
          job_type: job.job_type,
          priority: job.priority,
          current_status: job.current_status,
          reported_at: job.reported_at,
          description: job.description,
          source: job.source,
          created_by: row.actor,
          created_at: job.created_at,
          updated_at: job.updated_at,
          events: [
            {
              id: event.id,
              from_status: event.from_status,
              to_status: event.to_status,
              actor: row.actor,
              occurred_at: event.occurred_at,
              latitude: event.latitude,
              longitude: event.longitude,
              reason: event.reason,
              note: event.note,
            },
          ],
        }),
      };
    },
    async customers() {
      const r = await db.execute(
        sql`SELECT id,name FROM customers ORDER BY name,id`,
      );
      return customerOptionsSchema.parse({ items: r.rows });
    },
    async branches(id) {
      const r = await db.execute(
        sql`SELECT id,customer_id,name FROM branches WHERE customer_id=${id}::uuid ORDER BY name,id`,
      );
      return branchOptionsSchema.parse({ items: r.rows });
    },
    async equipment(id) {
      const r = await db.execute(
        sql`SELECT id,branch_id,label,type FROM equipment WHERE branch_id=${id}::uuid ORDER BY label,id`,
      );
      return equipmentOptionsSchema.parse({ items: r.rows });
    },
  };
}
