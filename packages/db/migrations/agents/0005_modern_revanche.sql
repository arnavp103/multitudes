CREATE TABLE "event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"version" smallint NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"actor_id" text,
	"subject_type" text NOT NULL,
	"subject_id" text NOT NULL,
	"run_id" uuid,
	"trace_id" text,
	"payload" jsonb NOT NULL,
	"idempotency_key" text,
	CONSTRAINT "event_idempotencyKey_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_name_time_idx" ON "event" USING btree ("name","occurred_at");--> statement-breakpoint
CREATE INDEX "event_subject_idx" ON "event" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "event_actor_time_idx" ON "event" USING btree ("actor_id","occurred_at");--> statement-breakpoint
CREATE INDEX "event_run_idx" ON "event" USING btree ("run_id");--> statement-breakpoint
CREATE FUNCTION "reject_event_mutation"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Business events are append-only' USING ERRCODE = '55000';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "event_append_only" BEFORE UPDATE OR DELETE ON "event"
FOR EACH ROW EXECUTE FUNCTION "reject_event_mutation"();
--> statement-breakpoint
CREATE TRIGGER "event_no_truncate" BEFORE TRUNCATE ON "event"
FOR EACH STATEMENT EXECUTE FUNCTION "reject_event_mutation"();
