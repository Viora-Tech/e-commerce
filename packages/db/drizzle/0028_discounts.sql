CREATE TABLE IF NOT EXISTS "discount" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"title" text NOT NULL,
	"kind" text DEFAULT 'code' NOT NULL,
	"code" text,
	"method" text NOT NULL,
	"value" integer DEFAULT 0 NOT NULL,
	"min_subtotal_paise" integer,
	"applies_to" text DEFAULT 'all' NOT NULL,
	"applies_to_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"usage_limit" integer,
	"usage_per_customer" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "discount_usage" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"discount_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"customer_id" uuid,
	"email" text,
	"amount_paise" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN IF NOT EXISTS "discount_code" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "discount_id" uuid;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "discount_code" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "discount_label" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN IF NOT EXISTS "discount_paise" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "discount" DROP CONSTRAINT IF EXISTS "discount_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "discount" ADD CONSTRAINT "discount_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_usage" DROP CONSTRAINT IF EXISTS "discount_usage_store_id_store_id_fk";--> statement-breakpoint
ALTER TABLE "discount_usage" ADD CONSTRAINT "discount_usage_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_usage" DROP CONSTRAINT IF EXISTS "discount_usage_discount_id_discount_id_fk";--> statement-breakpoint
ALTER TABLE "discount_usage" ADD CONSTRAINT "discount_usage_discount_id_discount_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discount"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_usage" DROP CONSTRAINT IF EXISTS "discount_usage_order_id_order_id_fk";--> statement-breakpoint
ALTER TABLE "discount_usage" ADD CONSTRAINT "discount_usage_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_usage" DROP CONSTRAINT IF EXISTS "discount_usage_customer_id_customer_id_fk";--> statement-breakpoint
ALTER TABLE "discount_usage" ADD CONSTRAINT "discount_usage_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "discount_store_code" ON "discount" USING btree ("store_id","code");--> statement-breakpoint
SELECT apply_store_rls();
