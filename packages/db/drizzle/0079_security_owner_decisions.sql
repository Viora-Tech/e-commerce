CREATE TABLE "newsletter_signup" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"confirmed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "newsletter_signup_status_check" CHECK ("newsletter_signup"."status" in ('pending', 'confirmed'))
);
--> statement-breakpoint
ALTER TABLE "customer_login_ticket" DROP CONSTRAINT "customer_login_ticket_kind_check";--> statement-breakpoint
ALTER TABLE "customer_login_ticket" DROP CONSTRAINT "customer_login_ticket_status_check";--> statement-breakpoint
ALTER TABLE "signup_invite" ADD COLUMN "plan_order_id" uuid;--> statement-breakpoint
ALTER TABLE "customer_login_ticket" ADD COLUMN "challenge" text;--> statement-breakpoint
ALTER TABLE "newsletter_signup" ADD CONSTRAINT "newsletter_signup_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_signup_store_email" ON "newsletter_signup" USING btree ("store_id","email");--> statement-breakpoint
CREATE INDEX "signup_invite_plan_order" ON "signup_invite" USING btree ("plan_order_id");--> statement-breakpoint
ALTER TABLE "customer_login_ticket" ADD CONSTRAINT "customer_login_ticket_kind_check" CHECK ("customer_login_ticket"."kind" in ('handoff', 'truecaller', 'magic_link', 'passkey_register', 'passkey_login'));--> statement-breakpoint
ALTER TABLE "customer_login_ticket" ADD CONSTRAINT "customer_login_ticket_status_check" CHECK ("customer_login_ticket"."status" in ('pending', 'ready', 'verify_email', 'verify_phone', 'phone_code_sent', 'failed'));--> statement-breakpoint
SELECT apply_store_rls();