import { JOB_STATUSES } from '@chillops/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', [
  'ops',
  'technician',
  'finance',
  'storekeeper',
  'director',
]);
export const technicianLevel = pgEnum('technician_level', ['senior', 'junior']);
export const contactKind = pgEnum('contact_kind', ['email', 'phone']);
export const equipmentType = pgEnum('equipment_type', [
  'refrigeration',
  'air_conditioning',
  'other',
]);
export const jobType = pgEnum('job_type', ['breakdown', 'planned_service']);
export const jobPriority = pgEnum('job_priority', [
  'routine',
  'urgent',
  'critical',
]);
export const jobStatus = pgEnum('job_status', JOB_STATUSES);
export const jobSource = pgEnum('job_source', ['email', 'manual']);
export const jobNumberSequence = pgSequence('job_number_seq', {
  startWith: 1001,
});

const identity = () => ({
  id: uuid('id').defaultRandom().primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();
const latitude = () => numeric('latitude', { precision: 9, scale: 6 });
const longitude = () => numeric('longitude', { precision: 9, scale: 6 });

export const users = pgTable(
  'users',
  {
    ...identity(),
    updatedAt: updatedAt(),
    fullName: text('full_name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: userRole('role').notNull(),
    active: boolean('active').default(true).notNull(),
  },
  (table) => [uniqueIndex('users_email_unique').on(sql`lower(${table.email})`)],
);

export const technicians = pgTable('technicians', {
  ...identity(),
  updatedAt: updatedAt(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'restrict' }),
  level: technicianLevel('level').notNull(),
  phone: text('phone').notNull(),
  active: boolean('active').default(true).notNull(),
});

export const customers = pgTable('customers', {
  ...identity(),
  updatedAt: updatedAt(),
  name: text('name').notNull(),
});

export const branches = pgTable(
  'branches',
  {
    ...identity(),
    updatedAt: updatedAt(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    address: text('address').notNull(),
    latitude: latitude(),
    longitude: longitude(),
  },
  (table) => [
    unique('branches_id_customer_unique').on(table.id, table.customerId),
    check(
      'branches_coordinates_paired',
      sql`(${table.latitude} IS NULL) = (${table.longitude} IS NULL)`,
    ),
    check('branches_latitude_range', sql`${table.latitude} BETWEEN -90 AND 90`),
    check(
      'branches_longitude_range',
      sql`${table.longitude} BETWEEN -180 AND 180`,
    ),
  ],
);

export const customerContacts = pgTable(
  'customer_contacts',
  {
    ...identity(),
    updatedAt: updatedAt(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    branchId: uuid('branch_id'),
    kind: contactKind('kind').notNull(),
    address: text('address').notNull(),
  },
  (table) => [
    foreignKey({
      name: 'contacts_branch_customer_fk',
      columns: [table.branchId, table.customerId],
      foreignColumns: [branches.id, branches.customerId],
    }).onDelete('restrict'),
    index('customer_contacts_address_idx').on(
      table.kind,
      sql`lower(${table.address})`,
    ),
  ],
);

export const equipment = pgTable(
  'equipment',
  {
    ...identity(),
    updatedAt: updatedAt(),
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id, { onDelete: 'restrict' }),
    type: equipmentType('type').notNull(),
    label: text('label').notNull(),
    model: text('model'),
    serialNumber: text('serial_number'),
  },
  (table) => [
    unique('equipment_id_branch_unique').on(table.id, table.branchId),
  ],
);

export const jobs = pgTable(
  'jobs',
  {
    ...identity(),
    updatedAt: updatedAt(),
    jobNumber: text('job_number')
      .default(sql`'JOB-' || nextval('job_number_seq')::text`)
      .notNull()
      .unique(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    branchId: uuid('branch_id').notNull(),
    equipmentId: uuid('equipment_id'),
    jobType: jobType('job_type').notNull(),
    priority: jobPriority('priority').notNull(),
    currentStatus: jobStatus('current_status').default('unassigned').notNull(),
    description: text('description').notNull(),
    source: jobSource('source').notNull(),
    reportedAt: timestamp('reported_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by').references(() => users.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    foreignKey({
      name: 'jobs_branch_customer_fk',
      columns: [table.branchId, table.customerId],
      foreignColumns: [branches.id, branches.customerId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'jobs_equipment_branch_fk',
      columns: [table.equipmentId, table.branchId],
      foreignColumns: [equipment.id, equipment.branchId],
    }).onDelete('restrict'),
    check(
      'jobs_manual_actor_required',
      sql`${table.source} <> 'manual' OR ${table.createdBy} IS NOT NULL`,
    ),
    index('jobs_status_idx').on(table.currentStatus),
    index('jobs_customer_idx').on(table.customerId),
    index('jobs_branch_idx').on(table.branchId),
  ],
);

export const jobEvents = pgTable(
  'job_events',
  {
    ...identity(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'restrict' }),
    fromStatus: jobStatus('from_status'),
    toStatus: jobStatus('to_status').notNull(),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'restrict',
    }),
    occurredAt: timestamp('occurred_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    latitude: latitude(),
    longitude: longitude(),
    reason: text('reason'),
    note: text('note'),
  },
  (table) => [
    index('job_events_job_time_idx').on(table.jobId, table.occurredAt),
    check(
      'job_events_coordinates_paired',
      sql`(${table.latitude} IS NULL) = (${table.longitude} IS NULL)`,
    ),
    check(
      'job_events_latitude_range',
      sql`${table.latitude} BETWEEN -90 AND 90`,
    ),
    check(
      'job_events_longitude_range',
      sql`${table.longitude} BETWEEN -180 AND 180`,
    ),
  ],
);

export const auditLog = pgTable('audit_log', {
  ...identity(),
  actorId: uuid('actor_id').references(() => users.id, {
    onDelete: 'restrict',
  }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  // Polymorphic historical reference: intentionally not a foreign key.
  entityId: uuid('entity_id').notNull(),
  details: jsonb('details')
    .default(sql`'{}'::jsonb`)
    .notNull(),
  occurredAt: timestamp('occurred_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
