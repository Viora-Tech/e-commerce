CREATE TABLE IF NOT EXISTS "marketing_automation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"template" text NOT NULL,
	"trigger" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'paused' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_automation_status" CHECK ("marketing_automation"."status" in ('active','paused'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_automation_run" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"automation_id" uuid NOT NULL,
	"trigger_key" text NOT NULL,
	"customer_id" uuid,
	"cart_id" uuid,
	"order_id" uuid,
	"email" text,
	"phone" text,
	"name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"step_index" integer DEFAULT 0 NOT NULL,
	"next_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stop_reason" text,
	"converted_order_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "marketing_run_status" CHECK ("marketing_automation_run"."status" in ('active','completed','converted','stopped'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_campaign" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"segment_id" uuid,
	"subject" text DEFAULT '' NOT NULL,
	"preview_text" text DEFAULT '' NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"whatsapp" jsonb,
	"scheduled_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"audience_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_campaign_status" CHECK ("marketing_campaign"."status" in ('draft','scheduled','sending','sent','cancelled','failed')),
	CONSTRAINT "marketing_campaign_kind" CHECK ("marketing_campaign"."kind" in ('email','whatsapp'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_message" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"campaign_id" uuid,
	"automation_id" uuid,
	"run_id" uuid,
	"step_index" integer,
	"customer_id" uuid,
	"channel" text NOT NULL,
	"to" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"provider_ref" text,
	"error" text,
	"sent_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"clicked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_message_status" CHECK ("marketing_message"."status" in ('queued','sent','failed','skipped'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "marketing_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"channel" text NOT NULL,
	"source" text,
	"medium" text,
	"campaign" text,
	"content" text,
	"term" text,
	"referrer" text,
	"landing_path" text,
	"campaign_id" uuid,
	"automation_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN IF NOT EXISTS "attribution" jsonb;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "accepts_whatsapp" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "marketing_consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "marketing_consent_source" text;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "unsubscribed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "attribution" jsonb;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_automation" ADD CONSTRAINT "marketing_automation_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_automation_run" ADD CONSTRAINT "marketing_automation_run_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_automation_run" ADD CONSTRAINT "marketing_automation_run_automation_id_marketing_automation_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."marketing_automation"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_automation_run" ADD CONSTRAINT "marketing_automation_run_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_automation_run" ADD CONSTRAINT "marketing_automation_run_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_automation_run" ADD CONSTRAINT "marketing_automation_run_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_automation_run" ADD CONSTRAINT "marketing_automation_run_converted_order_id_order_id_fk" FOREIGN KEY ("converted_order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_campaign" ADD CONSTRAINT "marketing_campaign_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_campaign" ADD CONSTRAINT "marketing_campaign_segment_id_customer_segment_id_fk" FOREIGN KEY ("segment_id") REFERENCES "public"."customer_segment"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_message" ADD CONSTRAINT "marketing_message_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_message" ADD CONSTRAINT "marketing_message_campaign_id_marketing_campaign_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."marketing_campaign"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_message" ADD CONSTRAINT "marketing_message_automation_id_marketing_automation_id_fk" FOREIGN KEY ("automation_id") REFERENCES "public"."marketing_automation"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_message" ADD CONSTRAINT "marketing_message_run_id_marketing_automation_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."marketing_automation_run"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_message" ADD CONSTRAINT "marketing_message_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "marketing_session" ADD CONSTRAINT "marketing_session_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_automation_store_trigger" ON "marketing_automation" USING btree ("store_id","trigger");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_run_trigger" ON "marketing_automation_run" USING btree ("automation_id","trigger_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_run_due" ON "marketing_automation_run" USING btree ("store_id","status","next_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_campaign_store_status" ON "marketing_campaign" USING btree ("store_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_message_campaign_to" ON "marketing_message" USING btree ("campaign_id","to") WHERE campaign_id is not null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "marketing_message_run_step" ON "marketing_message" USING btree ("run_id","step_index") WHERE run_id is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_message_store_created" ON "marketing_message" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_message_campaign" ON "marketing_message" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_session_store_started" ON "marketing_session" USING btree ("store_id","started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "marketing_session_campaign" ON "marketing_session" USING btree ("campaign_id");;--> statement-breakpoint
CREATE OR REPLACE FUNCTION stores_with_marketing_work() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM marketing_automation WHERE status = 'active'
  UNION
  SELECT store_id FROM marketing_campaign
    WHERE status = 'sending' OR (status = 'scheduled' AND scheduled_at <= now())
  UNION
  SELECT store_id FROM marketing_automation_run WHERE status = 'active' AND next_at <= now();
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_marketing_work() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_marketing_work() TO app;
--> statement-breakpoint
-- Abandoned-cart recovery moves into Marketing automations (idempotent). A store that had
-- `notifications.recoverAbandoned` on gets an active abandoned-checkout automation that
-- sends what the old sweep sent, four hours after the basket went quiet, through the same
-- recovery links. Carts the old sweep already nudged keep recovery_sent_at and are skipped.
INSERT INTO "marketing_automation" ("id", "store_id", "template", "trigger", "name", "status", "steps", "settings")
SELECT gen_random_uuid(), s."id", 'abandoned_checkout', 'checkout_abandoned', 'Abandoned checkout', 'active',
  '[{"id":"wait-1","type":"wait","minutes":180},{"id":"email-1","type":"email","subject":"You left something in your cart","previewText":"Your basket is saved. Finish your order in a click.","blocks":[{"id":"b1","type":"header"},{"id":"b2","type":"text","text":"Hi {first_name}, your basket at {store_name} is waiting for you."},{"id":"b3","type":"cart"},{"id":"b4","type":"button","label":"Return to checkout","url":"{checkout_url}"}]},{"id":"whatsapp-1","type":"whatsapp","template":{"name":"checkout_recovery","language":"en","variables":["{first_name}","{store_name}","{cart_total}","{checkout_url}"]}}]'::jsonb,
  '{"afterMinutes":60,"audience":"all"}'::jsonb
FROM "store" s
WHERE coalesce((s."notifications"->>'recoverAbandoned')::boolean, false)
  AND NOT EXISTS (SELECT 1 FROM "marketing_automation" a WHERE a."store_id" = s."id" AND a."template" = 'abandoned_checkout');
--> statement-breakpoint
-- The new `marketing` permissions go to every store's Administrator role, as new stores seed it.
INSERT INTO "role_permission" ("id", "store_id", "role_id", "permission")
SELECT gen_random_uuid(), r."store_id", r."id", p.permission
FROM "role" r
CROSS JOIN (VALUES ('marketing.read'), ('marketing.write'), ('marketing.send')) AS p(permission)
WHERE r."is_system" AND r."slug" = 'admin'
ON CONFLICT ("role_id", "permission") DO NOTHING;
--> statement-breakpoint
SELECT apply_store_rls();
