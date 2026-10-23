-- Automations (Shopify Flow equivalent): workflows, versions, runs, step runs, record history, HTTP secrets and monthly usage; marketing_message learns which engine run sent it.
CREATE TABLE "automation_run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"trigger_type" text NOT NULL,
	"trigger_key" text NOT NULL,
	"subject_type" text NOT NULL,
	"subject_id" uuid,
	"status" text DEFAULT 'queued' NOT NULL,
	"cursor" text,
	"next_at" timestamp with time zone DEFAULT now() NOT NULL,
	"depth" integer DEFAULT 0 NOT NULL,
	"caused_by_run_id" uuid,
	"is_test" boolean DEFAULT false NOT NULL,
	"metered" boolean DEFAULT true NOT NULL,
	"trigger_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"requested_by" text,
	"customer_id" uuid,
	"cart_id" uuid,
	"order_id" uuid,
	"email" text,
	"phone" text,
	"name" text,
	"converted_order_id" uuid,
	"stop_reason" text,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "automation_run_status" CHECK ("automation_run"."status" in ('queued','running','waiting','awaiting_approval','completed','failed','cancelled','skipped','converted','stopped'))
);
--> statement-breakpoint
CREATE TABLE "automation_run_record" (
	"run_id" uuid NOT NULL,
	"store_id" uuid NOT NULL,
	"record_type" text NOT NULL,
	"record_id" uuid NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_run_record_run_id_record_type_record_id_pk" PRIMARY KEY("run_id","record_type","record_id"),
	CONSTRAINT "automation_run_record_role" CHECK ("automation_run_record"."role" in ('subject','changed'))
);
--> statement-breakpoint
CREATE TABLE "automation_secret" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"handle" text NOT NULL,
	"value_encrypted" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_step_run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"node_id" text NOT NULL,
	"iteration" integer DEFAULT 0 NOT NULL,
	"kind" text NOT NULL,
	"action_id" text,
	"attempt" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"summary" text,
	"error" text,
	"retry_at" timestamp with time zone,
	"approval_expires_at" timestamp with time zone,
	"decided_by" text,
	"decided_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "automation_step_run_status" CHECK ("automation_step_run"."status" in ('running','succeeded','failed','skipped','then','otherwise','waiting','awaiting_approval','cancelled'))
);
--> statement-breakpoint
CREATE TABLE "automation_usage" (
	"store_id" uuid NOT NULL,
	"month" text NOT NULL,
	"runs" integer DEFAULT 0 NOT NULL,
	"warned_at_80" timestamp with time zone,
	"warned_at_100" timestamp with time zone,
	CONSTRAINT "automation_usage_store_id_month_pk" PRIMARY KEY("store_id","month")
);
--> statement-breakpoint
CREATE TABLE "automation_version" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"workflow_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"definition" jsonb NOT NULL,
	"published_by" text,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "automation_workflow" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'off' NOT NULL,
	"origin" text DEFAULT 'automations' NOT NULL,
	"template_id" text,
	"trigger_type" text NOT NULL,
	"published_version_id" uuid,
	"draft_definition" jsonb,
	"next_fire_at" timestamp with time zone,
	"problem" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "automation_workflow_status" CHECK ("automation_workflow"."status" in ('on','off')),
	CONSTRAINT "automation_workflow_origin" CHECK ("automation_workflow"."origin" in ('automations','growth'))
);
--> statement-breakpoint
ALTER TABLE "marketing_message" ADD COLUMN "automation_run_id" uuid;--> statement-breakpoint
ALTER TABLE "marketing_message" ADD COLUMN "automation_node_id" text;--> statement-breakpoint
ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_workflow_id_automation_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."automation_workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_version_id_automation_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."automation_version"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_run_record" ADD CONSTRAINT "automation_run_record_run_id_automation_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."automation_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_run_record" ADD CONSTRAINT "automation_run_record_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_secret" ADD CONSTRAINT "automation_secret_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_step_run" ADD CONSTRAINT "automation_step_run_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_step_run" ADD CONSTRAINT "automation_step_run_run_id_automation_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."automation_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_usage" ADD CONSTRAINT "automation_usage_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_version" ADD CONSTRAINT "automation_version_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_version" ADD CONSTRAINT "automation_version_workflow_id_automation_workflow_id_fk" FOREIGN KEY ("workflow_id") REFERENCES "public"."automation_workflow"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "automation_workflow" ADD CONSTRAINT "automation_workflow_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "automation_run_trigger" ON "automation_run" USING btree ("workflow_id","trigger_key");--> statement-breakpoint
CREATE INDEX "automation_run_due" ON "automation_run" USING btree ("store_id","status","next_at");--> statement-breakpoint
CREATE INDEX "automation_run_subject" ON "automation_run" USING btree ("store_id","subject_type","subject_id","started_at");--> statement-breakpoint
CREATE INDEX "automation_run_workflow" ON "automation_run" USING btree ("workflow_id","started_at");--> statement-breakpoint
CREATE INDEX "automation_run_store_started" ON "automation_run" USING btree ("store_id","started_at");--> statement-breakpoint
CREATE INDEX "automation_run_record_lookup" ON "automation_run_record" USING btree ("store_id","record_type","record_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_secret_handle" ON "automation_secret" USING btree ("store_id","handle");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_step_run_node" ON "automation_step_run" USING btree ("run_id","node_id","iteration");--> statement-breakpoint
CREATE INDEX "automation_step_run_approval" ON "automation_step_run" USING btree ("store_id","approval_expires_at") WHERE "automation_step_run"."status" = 'awaiting_approval';--> statement-breakpoint
CREATE INDEX "automation_step_run_store_started" ON "automation_step_run" USING btree ("store_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "automation_version_number" ON "automation_version" USING btree ("workflow_id","number");--> statement-breakpoint
CREATE INDEX "automation_workflow_trigger" ON "automation_workflow" USING btree ("store_id","trigger_type","status");--> statement-breakpoint
CREATE INDEX "automation_workflow_schedule" ON "automation_workflow" USING btree ("next_fire_at") WHERE "automation_workflow"."status" = 'on' and "automation_workflow"."next_fire_at" is not null;--> statement-breakpoint
ALTER TABLE "marketing_message" ADD CONSTRAINT "marketing_message_automation_run_id_automation_run_id_fk" FOREIGN KEY ("automation_run_id") REFERENCES "public"."automation_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_message_automation_step" ON "marketing_message" USING btree ("automation_run_id","automation_node_id") WHERE automation_run_id is not null;--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- New `automations` permissions (design §8.7). The system Administrator role gets all four, as new
-- stores seed it. Every other role that can read orders, customers or products gets read only;
-- write, publish and run are granted by hand in the role editor, so nobody gains them silently.
INSERT INTO "role_permission" ("id", "store_id", "role_id", "permission")
SELECT gen_random_uuid(), r."store_id", r."id", p.permission
FROM "role" r
CROSS JOIN (VALUES ('automations.read'), ('automations.write'), ('automations.publish'), ('automations.run')) AS p(permission)
WHERE r."is_system" AND r."slug" = 'admin'
ON CONFLICT ("role_id", "permission") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permission" ("id", "store_id", "role_id", "permission")
SELECT gen_random_uuid(), r."store_id", r."id", 'automations.read'
FROM "role" r
WHERE r."slug" <> 'owner' AND EXISTS (
  SELECT 1 FROM "role_permission" rp
  WHERE rp."role_id" = r."id" AND rp."permission" IN ('orders.read', 'customers.read', 'products.read')
)
ON CONFLICT ("role_id", "permission") DO NOTHING;
