CREATE TABLE IF NOT EXISTS "signup_waitlist" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"sells" text NOT NULL,
	"user_id" text,
	"invited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signup_waitlist_email_unique" UNIQUE("email")
);
--> statement-breakpoint
-- Platform-level, like signup_invite in 0070_signup_onboarding.sql: no store_id, no RLS.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "signup_waitlist" TO app;
--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "business_profile" jsonb;
