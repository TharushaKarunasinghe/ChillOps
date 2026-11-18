CREATE FUNCTION "public"."set_updated_at"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "users_updated_at" BEFORE UPDATE ON "users"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "technicians_updated_at" BEFORE UPDATE ON "technicians"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "customers_updated_at" BEFORE UPDATE ON "customers"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "customer_contacts_updated_at" BEFORE UPDATE ON "customer_contacts"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "branches_updated_at" BEFORE UPDATE ON "branches"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "equipment_updated_at" BEFORE UPDATE ON "equipment"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE TRIGGER "jobs_updated_at" BEFORE UPDATE ON "jobs"
FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();
--> statement-breakpoint
CREATE FUNCTION "public"."reject_job_events_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'job_events is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "job_events_append_only"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "job_events"
FOR EACH STATEMENT EXECUTE FUNCTION "public"."reject_job_events_mutation"();
