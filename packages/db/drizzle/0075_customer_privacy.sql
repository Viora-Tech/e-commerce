CREATE TABLE "cookie_consent" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"visitor_id" text,
	"customer_id" uuid,
	"analytics" boolean NOT NULL,
	"marketing" boolean NOT NULL,
	"banner_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_otp" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"channel" text NOT NULL,
	"destination_hash" text NOT NULL,
	"customer_id" uuid,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_otp_purpose_check" CHECK ("customer_otp"."purpose" in ('login', 'delete_account')),
	CONSTRAINT "customer_otp_channel_check" CHECK ("customer_otp"."channel" in ('email', 'sms', 'whatsapp'))
);
--> statement-breakpoint
CREATE TABLE "data_request" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"source" text NOT NULL,
	"customer_id" uuid,
	"contact_email" text,
	"contact_phone" text,
	"note" text,
	"due_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_request_kind_check" CHECK ("data_request"."kind" in ('export', 'delete')),
	CONSTRAINT "data_request_status_check" CHECK ("data_request"."status" in ('open', 'in_progress', 'completed', 'rejected')),
	CONSTRAINT "data_request_source_check" CHECK ("data_request"."source" in ('account', 'email', 'phone', 'other'))
);
--> statement-breakpoint
CREATE TABLE "marketing_consent_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"channel" text NOT NULL,
	"granted" boolean NOT NULL,
	"source" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketing_consent_event_channel_check" CHECK ("marketing_consent_event"."channel" in ('email', 'whatsapp', 'sms'))
);
--> statement-breakpoint
CREATE TABLE "privacy_audit_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"data_request_id" uuid,
	"customer_id" uuid,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"actor_label" text,
	"action" text NOT NULL,
	"detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "accepts_sms" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "customer" ADD COLUMN "anonymised_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cookie_consent" ADD CONSTRAINT "cookie_consent_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cookie_consent" ADD CONSTRAINT "cookie_consent_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_otp" ADD CONSTRAINT "customer_otp_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_otp" ADD CONSTRAINT "customer_otp_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_request" ADD CONSTRAINT "data_request_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_request" ADD CONSTRAINT "data_request_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_consent_event" ADD CONSTRAINT "marketing_consent_event_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketing_consent_event" ADD CONSTRAINT "marketing_consent_event_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_audit_event" ADD CONSTRAINT "privacy_audit_event_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_audit_event" ADD CONSTRAINT "privacy_audit_event_data_request_id_data_request_id_fk" FOREIGN KEY ("data_request_id") REFERENCES "public"."data_request"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_audit_event" ADD CONSTRAINT "privacy_audit_event_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cookie_consent_store_created" ON "cookie_consent" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "cookie_consent_customer" ON "cookie_consent" USING btree ("customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_otp_store_purpose_destination" ON "customer_otp" USING btree ("store_id","purpose","destination_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "data_request_store_number" ON "data_request" USING btree ("store_id","number");--> statement-breakpoint
CREATE INDEX "data_request_store_status" ON "data_request" USING btree ("store_id","status","due_at");--> statement-breakpoint
CREATE INDEX "data_request_customer" ON "data_request" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "marketing_consent_event_customer" ON "marketing_consent_event" USING btree ("customer_id","created_at");--> statement-breakpoint
CREATE INDEX "privacy_audit_event_store_created" ON "privacy_audit_event" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "privacy_audit_event_request" ON "privacy_audit_event" USING btree ("data_request_id");--> statement-breakpoint
CREATE INDEX "privacy_audit_event_customer" ON "privacy_audit_event" USING btree ("customer_id");--> statement-breakpoint
SELECT apply_store_rls();--> statement-breakpoint
-- The privacy audit trail is append only. A trigger rather than REVOKE: every later
-- migration re-runs apply_store_rls(), which grants UPDATE and DELETE again.
CREATE OR REPLACE FUNCTION privacy_audit_event_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'privacy_audit_event is append only';
END;
$$;--> statement-breakpoint
CREATE TRIGGER privacy_audit_event_append_only BEFORE UPDATE OR DELETE ON "privacy_audit_event"
  FOR EACH ROW EXECUTE FUNCTION privacy_audit_event_append_only();
