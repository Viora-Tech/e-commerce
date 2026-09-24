-- Shipping rates: zones (states and PIN code rules) with their rates, and the rate snapshot on orders.
CREATE TABLE IF NOT EXISTS "shipping_zone" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"state_codes" text[] DEFAULT '{}' NOT NULL,
	"pincode_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "shipping_rate" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"zone_id" uuid NOT NULL,
	"name" text NOT NULL,
	"condition" text DEFAULT 'none' NOT NULL,
	"min_value" integer,
	"max_value" integer,
	"price_paise" integer DEFAULT 0 NOT NULL,
	"free_above_paise" integer,
	"cod_surcharge_paise" integer,
	"min_transit_days" integer,
	"max_transit_days" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shipping_rate_id" uuid;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shipping_rate_name" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "shipping" jsonb;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "shipping_zone" ADD CONSTRAINT "shipping_zone_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "shipping_rate" ADD CONSTRAINT "shipping_rate_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "shipping_rate" ADD CONSTRAINT "shipping_rate_zone_id_shipping_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."shipping_zone"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipping_rate_zone" ON "shipping_rate" USING btree ("zone_id","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "shipping_zone_store" ON "shipping_zone" USING btree ("store_id","position");--> statement-breakpoint
SELECT apply_store_rls();
