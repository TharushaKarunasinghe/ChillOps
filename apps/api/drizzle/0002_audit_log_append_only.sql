CREATE FUNCTION "public"."reject_audit_log_mutation"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING
    ERRCODE = '55000',
    MESSAGE = 'audit_log is append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "audit_log_append_only"
BEFORE UPDATE OR DELETE OR TRUNCATE ON "audit_log"
FOR EACH STATEMENT EXECUTE FUNCTION "public"."reject_audit_log_mutation"();
