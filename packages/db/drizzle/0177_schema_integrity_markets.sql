CREATE TABLE "exchange_rate" (
	"id" uuid PRIMARY KEY NOT NULL,
	"base" text DEFAULT 'INR' NOT NULL,
	"quote" text NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"as_of" date NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rate_codes" CHECK ("exchange_rate"."base" ~ '^[A-Z]{3}$' and "exchange_rate"."quote" ~ '^[A-Z]{3}$'),
	CONSTRAINT "exchange_rate_positive" CHECK ("exchange_rate"."rate" > 0),
	CONSTRAINT "exchange_rate_source" CHECK ("exchange_rate"."source" in ('ecb', 'rbi', 'cbic', 'gateway', 'manual'))
);
--> statement-breakpoint
CREATE TABLE "market" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"handle" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"currency" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"locales" text[] DEFAULT '{}' NOT NULL,
	"subfolder" text,
	"store_domain_id" uuid,
	"price_adjustment_bp" integer DEFAULT 0 NOT NULL,
	"rounding" text DEFAULT 'none' NOT NULL,
	"manual_rate" numeric(18, 8),
	"duties" text DEFAULT 'dap' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_currency" CHECK ("market"."currency" ~ '^[A-Z]{3}$'),
	CONSTRAINT "market_locale" CHECK ("market"."locale" ~ '^[a-z]{2,3}$'),
	CONSTRAINT "market_subfolder" CHECK ("market"."subfolder" is null or "market"."subfolder" ~ '^[a-z]{2}(-[a-z]{2})?$'),
	CONSTRAINT "market_primary_root" CHECK (not "market"."is_primary" or "market"."subfolder" is null),
	CONSTRAINT "market_rounding" CHECK ("market"."rounding" in ('none', 'whole', 'x99')),
	CONSTRAINT "market_duties" CHECK ("market"."duties" in ('dap', 'ddp')),
	CONSTRAINT "market_adjustment" CHECK ("market"."price_adjustment_bp" between -5000 and 20000),
	CONSTRAINT "market_manual_rate" CHECK ("market"."manual_rate" is null or "market"."manual_rate" > 0)
);
--> statement-breakpoint
CREATE TABLE "market_region" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"market_id" uuid NOT NULL,
	"country_code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_region_country" CHECK ("market_region"."country_code" ~ '^[A-Z]{2}$')
);
--> statement-breakpoint
CREATE TABLE "store_counter" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"value" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "translation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"field" text NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "translation_resource" CHECK ("translation"."resource_type" in ('product', 'variant', 'collection', 'page', 'article', 'blog', 'navigation_menu', 'metaobject', 'shop')),
	CONSTRAINT "translation_locale" CHECK ("translation"."locale" ~ '^[a-z]{2,3}$')
);
--> statement-breakpoint
ALTER TABLE "address" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN "market_id" uuid;--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN "presentment_currency" text;--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN "country_code" text;--> statement-breakpoint
ALTER TABLE "customer_address" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "discount" ADD COLUMN "market_ids" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "market_id" uuid;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "presentment_currency" text;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "exchange_rate" numeric(18, 8);--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "presentment_subtotal_minor" bigint;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "presentment_shipping_minor" bigint;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "presentment_discount_minor" bigint;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "presentment_tax_minor" bigint;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "presentment_total_minor" bigint;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "tax_regime" text DEFAULT 'domestic_gst' NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "order_line" ADD COLUMN "presentment_unit_price_minor" bigint;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "currency" text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "payment" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "refund" ADD COLUMN "currency" text DEFAULT 'INR' NOT NULL;--> statement-breakpoint
ALTER TABLE "refund" ADD COLUMN "amount_minor" bigint;--> statement-breakpoint
ALTER TABLE "refund" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "shipping_zone" ADD COLUMN "country_codes" text[] DEFAULT '{"IN"}' NOT NULL;--> statement-breakpoint
ALTER TABLE "variant" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "supply_type" text DEFAULT 'domestic' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "currency" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "exchange_rate" numeric(18, 8);--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "port_code" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "shipping_bill_no" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "shipping_bill_date" date;--> statement-breakpoint
ALTER TABLE "market" ADD CONSTRAINT "market_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market" ADD CONSTRAINT "market_store_domain_id_store_domain_id_fk" FOREIGN KEY ("store_domain_id") REFERENCES "public"."store_domain"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_region" ADD CONSTRAINT "market_region_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_region" ADD CONSTRAINT "market_region_market_id_market_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."market"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_counter" ADD CONSTRAINT "store_counter_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "translation" ADD CONSTRAINT "translation_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exchange_rate_pair_day" ON "exchange_rate" USING btree ("base","quote","as_of","source");--> statement-breakpoint
CREATE UNIQUE INDEX "market_store_handle" ON "market" USING btree ("store_id","handle");--> statement-breakpoint
CREATE UNIQUE INDEX "market_one_primary" ON "market" USING btree ("store_id") WHERE "market"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "market_store_subfolder" ON "market" USING btree ("store_id","subfolder") WHERE "market"."subfolder" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "market_region_store_country" ON "market_region" USING btree ("store_id","country_code");--> statement-breakpoint
CREATE INDEX "market_region_market" ON "market_region" USING btree ("market_id");--> statement-breakpoint
CREATE UNIQUE INDEX "store_counter_store_name" ON "store_counter" USING btree ("store_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "translation_unique" ON "translation" USING btree ("store_id","resource_type","resource_id","locale","field");--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_market_id_market_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."market"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_market_id_market_id_fk" FOREIGN KEY ("market_id") REFERENCES "public"."market"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_gift_card_id_gift_card_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_card"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_pickup_id_shipment_pickup_id_fk" FOREIGN KEY ("pickup_id") REFERENCES "public"."shipment_pickup"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_gift_card_id_gift_card_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_card"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_exchange_order_id_order_id_fk" FOREIGN KEY ("exchange_order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_reship_shipment_id_shipment_id_fk" FOREIGN KEY ("reship_shipment_id") REFERENCES "public"."shipment"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_shipment_id_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipment"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
ALTER TABLE "return_request_line" ADD CONSTRAINT "return_request_line_exchange_variant_id_variant_id_fk" FOREIGN KEY ("exchange_variant_id") REFERENCES "public"."variant"("id") ON DELETE set null ON UPDATE no action NOT VALID;--> statement-breakpoint
CREATE INDEX "cart_store_status_updated" ON "cart" USING btree ("store_id","status","updated_at");--> statement-breakpoint
CREATE INDEX "cart_customer" ON "cart" USING btree ("customer_id") WHERE "cart"."customer_id" is not null;--> statement-breakpoint
CREATE INDEX "cart_line_cart" ON "cart_line" USING btree ("cart_id");--> statement-breakpoint
CREATE INDEX "cart_line_variant" ON "cart_line" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "collection_product_product" ON "collection_product" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "discount_usage_discount_email" ON "discount_usage" USING btree ("discount_id","email");--> statement-breakpoint
CREATE INDEX "discount_usage_order" ON "discount_usage" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "gift_card_transaction_order" ON "gift_card_transaction" USING btree ("order_id") WHERE "gift_card_transaction"."order_id" is not null;--> statement-breakpoint
CREATE INDEX "inventory_adjustment_variant" ON "inventory_adjustment" USING btree ("variant_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_level_location" ON "inventory_level" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "media_store_created" ON "media" USING btree ("store_id","created_at");--> statement-breakpoint
DO $$
BEGIN
  -- Unique when the data holds no duplicate numbers; else a plain index, so the deploy never
  -- fails and uniqueness waits for the duplicates to be fixed by hand.
  IF EXISTS (SELECT 1 FROM "order" GROUP BY store_id, number HAVING count(*) > 1) THEN
    CREATE INDEX "order_store_number_nonunique" ON "order" USING btree ("store_id","number");
  ELSE
    CREATE UNIQUE INDEX "order_store_number" ON "order" USING btree ("store_id","number");
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX "order_store_placed" ON "order" USING btree ("store_id","placed_at");--> statement-breakpoint
CREATE INDEX "order_customer" ON "order" USING btree ("customer_id") WHERE "order"."customer_id" is not null;--> statement-breakpoint
CREATE INDEX "order_line_order" ON "order_line" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_line_variant" ON "order_line" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "order_note_order" ON "order_note" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "payment_provider_ref" ON "payment" USING btree ("provider_ref");--> statement-breakpoint
CREATE INDEX "payment_order" ON "payment" USING btree ("order_id");--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM product GROUP BY store_id, handle HAVING count(*) > 1) THEN
    CREATE INDEX "product_store_handle_nonunique" ON "product" USING btree ("store_id","handle");
  ELSE
    CREATE UNIQUE INDEX "product_store_handle" ON "product" USING btree ("store_id","handle");
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX "product_store_status" ON "product" USING btree ("store_id","status","created_at");--> statement-breakpoint
CREATE INDEX "product_media_product" ON "product_media" USING btree ("product_id","position");--> statement-breakpoint
CREATE INDEX "product_media_media" ON "product_media" USING btree ("media_id");--> statement-breakpoint
CREATE INDEX "product_option_product" ON "product_option" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "product_option_value_option" ON "product_option_value" USING btree ("option_id");--> statement-breakpoint
CREATE INDEX "refund_order" ON "refund" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "refund_payment" ON "refund" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "shipment_order" ON "shipment" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "transfer_line_transfer" ON "transfer_line" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "variant_product" ON "variant" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "variant_store_sku" ON "variant" USING btree ("store_id","sku") WHERE "variant"."sku" is not null;--> statement-breakpoint
CREATE INDEX "variant_option_value_variant" ON "variant_option_value" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "variant_option_value_value" ON "variant_option_value" USING btree ("option_value_id");--> statement-breakpoint
CREATE INDEX "api_activity_grant" ON "api_activity" USING btree ("grant_id");--> statement-breakpoint
CREATE INDEX "marketing_run_customer" ON "marketing_automation_run" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "marketing_run_order" ON "marketing_automation_run" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "purchase_order_line_variant" ON "purchase_order_line" USING btree ("variant_id");--> statement-breakpoint
CREATE INDEX "invoice_order" ON "invoice" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "review_order" ON "review" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "review_customer" ON "review" USING btree ("customer_id");--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_tax_regime_check" CHECK ("order"."tax_regime" in ('domestic_gst', 'export_lut', 'export_igst'));--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_supply_type_check" CHECK ("invoice"."supply_type" in ('domestic', 'export_lut', 'export_igst'));;--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- Reference rates are platform-wide (no store_id): the worker writes them, every store reads them.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE exchange_rate TO app;
--> statement-breakpoint
-- updated_at that no write path can forget (schema review P1 item 5).
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON "order";--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "order" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON "variant";--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "variant" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON "payment";--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "payment" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON "refund";--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "refund" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
-- Markets and translations change what storefront pages show (0115).
DROP TRIGGER IF EXISTS storefront_cache_notify ON "market";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "market"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "market_region";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "market_region"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "translation";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "translation"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();
--> statement-breakpoint
-- Every store's primary market: India, in the store's own currency, no subfolder.
INSERT INTO market (id, store_id, name, handle, is_primary, enabled, currency, locale)
SELECT gen_random_uuid(), s.id, 'India', 'india', true, true,
       CASE WHEN upper(s.currency) ~ '^[A-Z]{3}$' THEN upper(s.currency) ELSE 'INR' END, 'en'
FROM store s
WHERE NOT EXISTS (SELECT 1 FROM market m WHERE m.store_id = s.id AND m.is_primary);
--> statement-breakpoint
INSERT INTO market_region (id, store_id, market_id, country_code)
SELECT gen_random_uuid(), m.store_id, m.id, 'IN'
FROM market m
WHERE m.is_primary
  AND NOT EXISTS (SELECT 1 FROM market_region r WHERE r.store_id = m.store_id AND r.country_code = 'IN');
--> statement-breakpoint
-- The order counter moves off the store row (P1 item 4). Seeded past both the store's counter
-- and its highest order number, so no number is handed out twice.
INSERT INTO store_counter (id, store_id, name, value)
SELECT gen_random_uuid(), s.id, 'order',
       greatest(s.next_order_number, coalesce((SELECT max(o.number) + 1 FROM "order" o WHERE o.store_id = s.id), 1))
FROM store s
WHERE NOT EXISTS (SELECT 1 FROM store_counter c WHERE c.store_id = s.id AND c.name = 'order');
--> statement-breakpoint
-- The storefront proxy picks a market before any store context exists: a store's markets with
-- their countries and dedicated domain, read across RLS (like resolve_host).
CREATE OR REPLACE FUNCTION store_markets(p_store_id uuid)
RETURNS TABLE (
  id uuid, handle text, is_primary boolean, enabled boolean, currency text, locale text,
  locales text[], subfolder text, hostname text, countries text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.handle, m.is_primary, m.enabled, m.currency, m.locale, m.locales, m.subfolder,
         d.hostname,
         coalesce(array_agg(r.country_code ORDER BY r.country_code)
                  FILTER (WHERE r.country_code IS NOT NULL), '{}')
  FROM market m
  LEFT JOIN store_domain d ON d.id = m.store_domain_id AND d.status = 'active'
  LEFT JOIN market_region r ON r.market_id = m.id
  WHERE m.store_id = p_store_id
  GROUP BY m.id, d.hostname;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION store_markets(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION store_markets(uuid) TO app;
--> statement-breakpoint
-- Stores with carts or logs past retention, for the worker's daily prune (P0 item 3, P1 item 6).
-- The periods match the prune: carts with no contact 30 days, recoverable carts 90, converted
-- carts 30; dispatched outbox rows 30; gateway and courier webhook payloads 180.
CREATE OR REPLACE FUNCTION stores_with_retention_due(p_at timestamptz) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM cart
   WHERE (status = 'open' AND email IS NULL AND phone IS NULL AND updated_at < p_at - interval '30 days')
      OR (status <> 'converted' AND (email IS NOT NULL OR phone IS NOT NULL) AND updated_at < p_at - interval '90 days')
      OR (status = 'converted' AND updated_at < p_at - interval '30 days')
  UNION
  SELECT store_id FROM outbox_event WHERE dispatched_at < p_at - interval '30 days'
  UNION
  SELECT store_id FROM payment_event
   WHERE received_at < p_at - interval '180 days' AND status IN ('processed', 'failed') AND payload <> '{}'::jsonb
  UNION
  SELECT store_id FROM shipment_webhook_event
   WHERE received_at < p_at - interval '180 days' AND status IN ('processed', 'failed') AND payload <> '{}'::jsonb;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_retention_due(timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_retention_due(timestamptz) TO app;
