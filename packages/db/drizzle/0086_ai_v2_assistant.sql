CREATE TABLE "ai_action" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"source" text DEFAULT 'assistant' NOT NULL,
	"tool" text NOT NULL,
	"status" text DEFAULT 'proposed' NOT NULL,
	"summary" text NOT NULL,
	"input" jsonb NOT NULL,
	"preview" jsonb NOT NULL,
	"result" jsonb,
	"undo" jsonb,
	"error" text,
	"flagged" boolean DEFAULT false NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"executed_at" timestamp with time zone,
	"undone_by" text,
	"undone_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_action_status_check" CHECK ("ai_action"."status" in ('proposed', 'executed', 'failed', 'cancelled', 'expired', 'undone')),
	CONSTRAINT "ai_action_source_check" CHECK ("ai_action"."source" in ('assistant', 'bulkWriter'))
);
--> statement-breakpoint
CREATE TABLE "ai_job" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"kind" text DEFAULT 'productCopy' NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"options" jsonb NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"done" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_job_status_check" CHECK ("ai_job"."status" in ('queued', 'running', 'done', 'failed', 'cancelled')),
	CONSTRAINT "ai_job_kind_check" CHECK ("ai_job"."kind" in ('productCopy'))
);
--> statement-breakpoint
CREATE TABLE "ai_job_item" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"suggestion" jsonb,
	"error" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_job_item_status_check" CHECK ("ai_job_item"."status" in ('pending', 'running', 'ready', 'failed', 'applied', 'skipped'))
);
--> statement-breakpoint
ALTER TABLE "ai_settings" ADD COLUMN "writing_quality" text DEFAULT 'standard' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_action" ADD CONSTRAINT "ai_action_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_job" ADD CONSTRAINT "ai_job_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_job_item" ADD CONSTRAINT "ai_job_item_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_job_item" ADD CONSTRAINT "ai_job_item_job_id_ai_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."ai_job"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_job_item" ADD CONSTRAINT "ai_job_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_action_store_created" ON "ai_action" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_job_store_created" ON "ai_job" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_job_item_job_product" ON "ai_job_item" USING btree ("job_id","product_id");--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_writing_quality_check" CHECK ("ai_settings"."writing_quality" in ('standard', 'best'));--> statement-breakpoint
-- AI v2 (assistant actions, bulk AI runs) is per store: forced RLS with the store_isolation policy, like every tenant table.
SELECT apply_store_rls();
