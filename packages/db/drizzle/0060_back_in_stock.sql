CREATE TABLE IF NOT EXISTS "back_in_stock_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "back_in_stock_signup" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"email" text,
	"phone" text,
	"status" text DEFAULT 'pending_confirmation' NOT NULL,
	"consent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"confirm_token" text,
	"unsubscribe_token" text NOT NULL,
	"confirmed_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"unsubscribed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "back_in_stock_signup_status_check" CHECK ("back_in_stock_signup"."status" in ('pending_confirmation', 'confirmed', 'notified', 'unsubscribed')),
	CONSTRAINT "back_in_stock_signup_contact_check" CHECK ("back_in_stock_signup"."email" is not null or "back_in_stock_signup"."phone" is not null)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "back_in_stock_usage" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"period" text NOT NULL,
	"channel" text NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "back_in_stock_usage_channel_check" CHECK ("back_in_stock_usage"."channel" in ('email', 'whatsapp'))
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "back_in_stock_settings" ADD CONSTRAINT "back_in_stock_settings_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "back_in_stock_signup" ADD CONSTRAINT "back_in_stock_signup_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "back_in_stock_signup" ADD CONSTRAINT "back_in_stock_signup_variant_id_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "back_in_stock_signup" ADD CONSTRAINT "back_in_stock_signup_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "back_in_stock_usage" ADD CONSTRAINT "back_in_stock_usage_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "back_in_stock_settings_store" ON "back_in_stock_settings" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "back_in_stock_signup_email_live" ON "back_in_stock_signup" USING btree ("store_id","variant_id",lower("email")) WHERE "back_in_stock_signup"."email" is not null and "back_in_stock_signup"."status" <> 'unsubscribed';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "back_in_stock_signup_phone_live" ON "back_in_stock_signup" USING btree ("store_id","variant_id","phone") WHERE "back_in_stock_signup"."phone" is not null and "back_in_stock_signup"."status" <> 'unsubscribed';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "back_in_stock_signup_confirm_token" ON "back_in_stock_signup" USING btree ("confirm_token");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "back_in_stock_signup_unsubscribe_token" ON "back_in_stock_signup" USING btree ("unsubscribe_token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "back_in_stock_signup_store_variant_status" ON "back_in_stock_signup" USING btree ("store_id","variant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "back_in_stock_usage_store_period_channel" ON "back_in_stock_usage" USING btree ("store_id","period","channel");
--> statement-breakpoint
SELECT apply_store_rls();
