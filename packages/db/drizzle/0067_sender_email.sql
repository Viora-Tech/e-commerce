CREATE TABLE IF NOT EXISTS "sender_email" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"email" text NOT NULL,
	"domain" text NOT NULL,
	"display_name" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"provider" text NOT NULL,
	"dkim_tokens" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"dkim_hosted_zone" text,
	"mail_from_domain" text,
	"mail_from_status" text,
	"last_checked_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sender_email_domain_unique" UNIQUE("domain"),
	CONSTRAINT "sender_email_status" CHECK ("sender_email"."status" in ('pending', 'verified', 'failed')),
	CONSTRAINT "sender_email_mail_from_status" CHECK ("sender_email"."mail_from_status" is null or "sender_email"."mail_from_status" in ('pending', 'verified', 'failed'))
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "sender_email" ADD CONSTRAINT "sender_email_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "sender_email_store" ON "sender_email" USING btree ("store_id");--> statement-breakpoint
-- Is this domain, a parent of it or a subdomain of it claimed by another store?
-- SECURITY DEFINER so it can see past RLS; returns only a yes/no, never which store.
CREATE OR REPLACE FUNCTION sender_domain_taken(p_domain text, p_store uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM sender_email
    WHERE store_id <> p_store
      AND (domain = lower(p_domain)
        OR lower(p_domain) LIKE '%.' || domain
        OR domain LIKE '%.' || lower(p_domain))
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION sender_domain_taken(text, uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION sender_domain_taken(text, uuid) TO app;--> statement-breakpoint
-- Stores whose sender domain needs a look: still pending, or verified but not checked for a day.
CREATE OR REPLACE FUNCTION stores_with_sender_email_checks() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM sender_email
  WHERE status = 'pending'
     OR (status = 'verified' AND (last_checked_at IS NULL OR last_checked_at < now() - interval '1 day'));
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_sender_email_checks() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_sender_email_checks() TO app;--> statement-breakpoint
SELECT apply_store_rls();
