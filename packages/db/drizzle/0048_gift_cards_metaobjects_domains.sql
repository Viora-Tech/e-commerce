-- Gift cards, metaobjects + metafields, and custom domains. Idempotent throughout.
CREATE TABLE IF NOT EXISTS "gift_card" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"code_cipher" text,
	"last_characters" text NOT NULL,
	"initial_value_paise" integer NOT NULL,
	"balance_paise" integer NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"expires_on" date,
	"disabled_at" timestamp with time zone,
	"customer_id" uuid,
	"recipient_email" text,
	"recipient_name" text,
	"message" text,
	"note" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"order_id" uuid,
	"order_line_id" uuid,
	"line_index" integer,
	"delivered_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_card_balance" CHECK ("gift_card"."balance_paise" >= 0),
	CONSTRAINT "gift_card_initial" CHECK ("gift_card"."initial_value_paise" > 0),
	CONSTRAINT "gift_card_source" CHECK ("gift_card"."source" in ('manual', 'purchase'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gift_card_transaction" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"gift_card_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"balance_after_paise" integer NOT NULL,
	"order_id" uuid,
	"payment_id" uuid,
	"note" text,
	"author" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gift_card_transaction_kind" CHECK ("gift_card_transaction"."kind" in ('issue', 'debit', 'refund', 'adjustment'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "metafield_definition" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"owner_type" text NOT NULL,
	"namespace" text DEFAULT 'custom' NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"list" boolean DEFAULT false NOT NULL,
	"validations" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"storefront_access" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metafield_definition_owner" CHECK ("metafield_definition"."owner_type" in ('product', 'collection')),
	CONSTRAINT "metafield_definition_key" CHECK ("metafield_definition"."key" ~ '^[a-z][a-z0-9_]{0,63}$'),
	CONSTRAINT "metafield_definition_namespace" CHECK ("metafield_definition"."namespace" ~ '^[a-z][a-z0-9_]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "metafield" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"owner_type" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "metaobject_definition" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"display_name_key" text,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"storefront_access" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "metaobject_definition_type" CHECK ("metaobject_definition"."type" ~ '^[a-z][a-z0-9_]{0,63}$')
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "metaobject" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"definition_id" uuid NOT NULL,
	"handle" text NOT NULL,
	"fields" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN IF NOT EXISTS "gift_card" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "is_gift_card" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN IF NOT EXISTS "gift_cards" jsonb;--> statement-breakpoint
-- Defaults describe the domains a store is created with (platform, live, with SSL), so
-- existing rows and every existing insert path keep resolving; custom domains are
-- inserted by the domains service as pending.
ALTER TABLE "store_domain" ADD COLUMN IF NOT EXISTS "kind" text DEFAULT 'platform' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_domain" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_domain" ADD COLUMN IF NOT EXISTS "ssl_status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "store_domain" ADD COLUMN IF NOT EXISTS "redirect_to_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "store_domain" ADD COLUMN IF NOT EXISTS "verification_token" text;--> statement-breakpoint
ALTER TABLE "store_domain" ADD COLUMN IF NOT EXISTS "error" text;--> statement-breakpoint
ALTER TABLE "store_domain" ADD COLUMN IF NOT EXISTS "last_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_domain" ADD COLUMN IF NOT EXISTS "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "store_domain" ADD COLUMN IF NOT EXISTS "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "gift_card" ADD CONSTRAINT "gift_card_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "gift_card" ADD CONSTRAINT "gift_card_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "gift_card" ADD CONSTRAINT "gift_card_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "gift_card" ADD CONSTRAINT "gift_card_order_line_id_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "gift_card_transaction" ADD CONSTRAINT "gift_card_transaction_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "gift_card_transaction" ADD CONSTRAINT "gift_card_transaction_gift_card_id_gift_card_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_card"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "gift_card_transaction" ADD CONSTRAINT "gift_card_transaction_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "gift_card_transaction" ADD CONSTRAINT "gift_card_transaction_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "metafield" ADD CONSTRAINT "metafield_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "metafield" ADD CONSTRAINT "metafield_definition_id_metafield_definition_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."metafield_definition"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "metafield_definition" ADD CONSTRAINT "metafield_definition_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "metaobject" ADD CONSTRAINT "metaobject_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "metaobject" ADD CONSTRAINT "metaobject_definition_id_metaobject_definition_id_fk" FOREIGN KEY ("definition_id") REFERENCES "public"."metaobject_definition"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "metaobject_definition" ADD CONSTRAINT "metaobject_definition_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "store_domain" ADD CONSTRAINT "store_domain_kind" CHECK ("store_domain"."kind" in ('platform', 'custom'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "store_domain" ADD CONSTRAINT "store_domain_status" CHECK ("store_domain"."status" in ('pending', 'active', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "store_domain" ADD CONSTRAINT "store_domain_ssl_status" CHECK ("store_domain"."ssl_status" in ('pending', 'issuing', 'active', 'failed'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gift_card_store_code" ON "gift_card" USING btree ("store_id","code_hash");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "gift_card_order_line" ON "gift_card" USING btree ("order_line_id","line_index") WHERE order_line_id is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gift_card_customer" ON "gift_card" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "gift_card_transaction_card" ON "gift_card_transaction" USING btree ("gift_card_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "metafield_definition_owner" ON "metafield" USING btree ("definition_id","owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "metafield_owner" ON "metafield" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "metafield_definition_owner_key" ON "metafield_definition" USING btree ("store_id","owner_type","namespace","key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "metaobject_definition_handle" ON "metaobject" USING btree ("definition_id","handle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "metaobject_store" ON "metaobject" USING btree ("store_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "metaobject_definition_store_type" ON "metaobject_definition" USING btree ("store_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "store_domain_one_primary" ON "store_domain" USING btree ("store_id") WHERE is_primary;--> statement-breakpoint
-- Only live domains resolve. Pending and failed custom domains 404 until verified.
CREATE OR REPLACE FUNCTION resolve_store(p_hostname text) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM store_domain WHERE hostname = lower(p_hostname) AND status = 'active' LIMIT 1;
$$;--> statement-breakpoint
-- Host routing for the storefront proxy: the store, its primary hostname, and whether
-- this host should 301 there. Exposes only what routing needs.
CREATE OR REPLACE FUNCTION resolve_host(p_hostname text)
RETURNS TABLE (store_id uuid, primary_hostname text, redirect boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.store_id,
    (SELECT p.hostname FROM store_domain p
      WHERE p.store_id = d.store_id AND p.is_primary AND p.status = 'active' LIMIT 1),
    (d.redirect_to_primary AND NOT d.is_primary)
  FROM store_domain d
  WHERE d.hostname = lower(p_hostname) AND d.status = 'active'
  LIMIT 1;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION resolve_host(text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION resolve_host(text) TO app;--> statement-breakpoint
-- Store ids with custom domains still waiting on DNS or SSL, for the worker's poll.
CREATE OR REPLACE FUNCTION stores_with_pending_domains() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM store_domain
  WHERE kind = 'custom' AND (status = 'pending' OR (status = 'active' AND ssl_status IN ('pending', 'issuing')));
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_pending_domains() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_pending_domains() TO app;--> statement-breakpoint
SELECT apply_store_rls();
