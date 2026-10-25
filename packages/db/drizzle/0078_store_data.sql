CREATE TABLE "platform_audit_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"subject_store_id" uuid NOT NULL,
	"subject_store_slug" text,
	"subject_store_name" text,
	"actor_user_id" text,
	"actor_email" text,
	"action" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_export" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"key" text,
	"size_bytes" integer,
	"table_count" integer,
	"row_count" integer,
	"error" text,
	"requested_by" text,
	"requested_by_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "store_export_status_check" CHECK ("store_export"."status" in ('queued', 'running', 'ready', 'failed'))
);
--> statement-breakpoint
ALTER TABLE "store_export" ADD CONSTRAINT "store_export_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "platform_audit_event_subject" ON "platform_audit_event" USING btree ("subject_store_id","created_at");--> statement-breakpoint
CREATE INDEX "store_export_store_created" ON "store_export" USING btree ("store_id","created_at");--> statement-breakpoint
SELECT apply_store_rls();--> statement-breakpoint
-- Platform-level and append only: the app role records store exports and deletions here
-- but can never read, change or delete a row (the platform owner reads it as owner).
GRANT INSERT ON TABLE "platform_audit_event" TO app;--> statement-breakpoint
-- Closing a store deletes every row with its store_id, the privacy audit trail included.
-- The trail stays append only otherwise: a DELETE passes only inside the transaction
-- that closes that same store (`app.store_delete` set to its id, transaction-local).
CREATE OR REPLACE FUNCTION privacy_audit_event_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND nullif(current_setting('app.store_delete', true), '') = OLD.store_id::text THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'privacy_audit_event is append only';
END;
$$;
--> statement-breakpoint
SELECT apply_store_rls();
