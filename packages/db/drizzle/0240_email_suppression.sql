-- Bounce and complaint handling (#1569): Amazon SES reports bounces and complaints through SNS to
-- the worker; each store keeps the addresses it must stop mailing. New tables only, so an older
-- build that never reads them keeps working during a rolling deploy.
CREATE TABLE IF NOT EXISTS "email_suppression" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"email" text NOT NULL,
	"reason" text NOT NULL,
	"detail" text,
	"suppressed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cleared_at" timestamp with time zone,
	"cleared_by" text,
	CONSTRAINT "email_suppression_reason" CHECK ("email_suppression"."reason" in ('hard_bounce', 'soft_bounces', 'complaint'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_feedback_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"sns_message_id" text NOT NULL,
	"email" text NOT NULL,
	"kind" text NOT NULL,
	"bounce_type" text,
	"sub_type" text,
	"detail" text,
	"ses_message_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_feedback_event_kind" CHECK ("email_feedback_event"."kind" in ('bounce', 'complaint'))
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "email_suppression" ADD CONSTRAINT "email_suppression_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "email_feedback_event" ADD CONSTRAINT "email_feedback_event_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_suppression_store_email" ON "email_suppression" USING btree ("store_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_feedback_event_message" ON "email_feedback_event" USING btree ("store_id","sns_message_id","email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_feedback_event_email" ON "email_feedback_event" USING btree ("store_id","email","created_at");--> statement-breakpoint
-- The store that owns a verified sender domain, for a bounce whose message carried no store tag
-- (an identity notification). SECURITY DEFINER so the worker sees past RLS; returns only the id.
CREATE OR REPLACE FUNCTION store_for_sender_domain(p_domain text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM sender_email WHERE domain = lower(p_domain) LIMIT 1;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION store_for_sender_domain(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION store_for_sender_domain(text) TO app;--> statement-breakpoint
-- The store a store tag names, if it exists, so a store tag on a bounce cannot point the insert at nothing.
CREATE OR REPLACE FUNCTION store_for_email_tag(p_store uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM store WHERE id = p_store;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION store_for_email_tag(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION store_for_email_tag(uuid) TO app;--> statement-breakpoint
SELECT apply_store_rls();
