CREATE TABLE "model_call" (
	"id" uuid PRIMARY KEY NOT NULL,
	"run_id" uuid NOT NULL,
	"attempt" integer NOT NULL,
	"purpose" text NOT NULL,
	"provider" text NOT NULL,
	"model_id" text NOT NULL,
	"status" text NOT NULL,
	"usage" jsonb,
	"estimated_cost_usd" double precision,
	"pricing" jsonb,
	"error_type" text,
	"duration_ms" integer,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "eval_case" ADD COLUMN "judge" jsonb;--> statement-breakpoint
ALTER TABLE "eval_score" ADD COLUMN "judge" jsonb;--> statement-breakpoint
ALTER TABLE "model_call" ADD CONSTRAINT "model_call_run_id_agent_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."agent_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "model_call_run_idx" ON "model_call" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "model_call_started_idx" ON "model_call" USING btree ("started_at");