-- Generated from createJobStatement; this file is for review, not a migration.
-- Parameters in order: customer_id, branch_id, equipment_id, customer_id,
-- equipment_id, branch_id, customer_id, branch_id, equipment_id, job_type,
-- priority, description, actor_id, actor_id.
WITH customer AS MATERIALIZED (
      SELECT * FROM customers WHERE id = $1::uuid FOR SHARE
    ), branch AS MATERIALIZED (
      SELECT * FROM branches WHERE id = $2::uuid FOR SHARE
    ), item AS MATERIALIZED (
      SELECT * FROM equipment WHERE id = $3::uuid FOR SHARE
    ), validation AS (
      SELECT CASE
        WHEN NOT EXISTS (SELECT 1 FROM customer) THEN 'customer_id'
        WHEN NOT EXISTS (SELECT 1 FROM branch WHERE customer_id = $4::uuid) THEN 'branch_id'
        WHEN $5::uuid IS NOT NULL AND NOT EXISTS
          (SELECT 1 FROM item WHERE branch_id = $6::uuid) THEN 'equipment_id'
        ELSE NULL END AS error_field
    ), created AS (
      INSERT INTO jobs (customer_id, branch_id, equipment_id, job_type, priority,
        description, current_status, source, created_by)
      SELECT $7::uuid, $8::uuid, $9::uuid,
        $10::job_type, $11::job_priority, $12::text,
        'unassigned', 'manual', $13::uuid
      FROM validation WHERE error_field IS NULL RETURNING *
    ), initial_event AS (
      INSERT INTO job_events (job_id, from_status, to_status, actor_id, occurred_at)
      SELECT id, NULL, 'unassigned', created_by, reported_at FROM created RETURNING *
    ), audited AS (
      INSERT INTO audit_log (actor_id, action, entity_type, entity_id)
      SELECT j.created_by, 'job.create', 'job', j.id
      FROM created j JOIN initial_event e ON e.job_id = j.id RETURNING id
    )
    SELECT validation.error_field,
      (SELECT to_jsonb(j) FROM created j) AS job,
      (SELECT to_jsonb(e) FROM initial_event e) AS initial_event,
      (SELECT jsonb_build_object('id', id, 'name', name) FROM customer) AS customer,
      (SELECT jsonb_build_object('id', id, 'name', name, 'address', address,
        'latitude', latitude, 'longitude', longitude) FROM branch) AS branch,
      (SELECT jsonb_build_object('id', id, 'type', type, 'label', label,
        'model', model, 'serial_number', serial_number) FROM item) AS equipment,
      (SELECT jsonb_build_object('id', id, 'full_name', full_name) FROM users WHERE id = $14::uuid) AS actor,
      (SELECT id FROM audited) AS audit_id
    FROM validation;
