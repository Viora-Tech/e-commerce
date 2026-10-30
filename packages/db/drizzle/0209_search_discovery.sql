CREATE TABLE "discovery_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"session_key" text NOT NULL,
	"source" text NOT NULL,
	"kind" text NOT NULL,
	"query" text,
	"results" integer,
	"product_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_event_source_check" CHECK ("discovery_event"."source" in ('search', 'related', 'complementary')),
	CONSTRAINT "discovery_event_kind_check" CHECK ("discovery_event"."kind" in ('search', 'impression', 'click', 'add', 'checkout'))
);
--> statement-breakpoint
CREATE TABLE "product_recommendation" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"recommended_id" uuid NOT NULL,
	"intent" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_recommendation_intent_check" CHECK ("product_recommendation"."intent" in ('related', 'complementary'))
);
--> statement-breakpoint
CREATE TABLE "search_boost" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"field" text NOT NULL,
	"value" text NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "search_boost_field_check" CHECK ("search_boost"."field" in ('tag', 'type', 'vendor')),
	CONSTRAINT "search_boost_action_check" CHECK ("search_boost"."action" in ('boost', 'bury'))
);
--> statement-breakpoint
CREATE TABLE "search_pin" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"term" text NOT NULL,
	"product_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discovery_event" ADD CONSTRAINT "discovery_event_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recommendation" ADD CONSTRAINT "product_recommendation_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recommendation" ADD CONSTRAINT "product_recommendation_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_recommendation" ADD CONSTRAINT "product_recommendation_recommended_id_product_id_fk" FOREIGN KEY ("recommended_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_boost" ADD CONSTRAINT "search_boost_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_pin" ADD CONSTRAINT "search_pin_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "search_pin" ADD CONSTRAINT "search_pin_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discovery_event_store_created" ON "discovery_event" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "discovery_event_store_session" ON "discovery_event" USING btree ("store_id","session_key","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_recommendation_pick" ON "product_recommendation" USING btree ("store_id","product_id","intent","recommended_id");--> statement-breakpoint
CREATE UNIQUE INDEX "search_boost_field_value" ON "search_boost" USING btree ("store_id","field","value");--> statement-breakpoint
CREATE UNIQUE INDEX "search_pin_term_product" ON "search_pin" USING btree ("store_id","term","product_id");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- Search & discovery (0209): pins, boosts and picked recommendations change what search and
-- product pages show, so a write drops the store's cached pages.
DROP TRIGGER IF EXISTS storefront_cache_notify ON "search_pin";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "search_pin"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "search_boost";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "search_boost"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "product_recommendation";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "product_recommendation"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
-- The daily prune also visits stores with search and recommendation events over 90 days old.
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
   WHERE received_at < p_at - interval '180 days' AND status IN ('processed', 'failed') AND payload <> '{}'::jsonb
  UNION
  SELECT store_id FROM discovery_event WHERE created_at < p_at - interval '90 days';
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_retention_due(timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_retention_due(timestamptz) TO app;
