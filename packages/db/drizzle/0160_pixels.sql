CREATE TABLE "pixel_connection" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"platform" text DEFAULT 'meta' NOT NULL,
	"pixel_id" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"token_enc" text,
	"token_hint" text,
	"test_event_code" text,
	"events" text[] DEFAULT ARRAY['PageView','ViewContent','AddToCart','InitiateCheckout','Purchase']::text[] NOT NULL,
	"purchase_trigger" text DEFAULT 'placed' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_error" text,
	"last_error_at" timestamp with time zone,
	"last_sent_at" timestamp with time zone,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pixel_connection_platform" CHECK ("pixel_connection"."platform" in ('meta')),
	CONSTRAINT "pixel_connection_trigger" CHECK ("pixel_connection"."purchase_trigger" in ('placed','paid','delivered','paid_or_delivered')),
	CONSTRAINT "pixel_connection_status" CHECK ("pixel_connection"."status" in ('active','paused','errored')),
	CONSTRAINT "pixel_connection_pixel_id" CHECK ("pixel_connection"."pixel_id" ~ '^[0-9]{10,20}$')
);
--> statement-breakpoint
CREATE TABLE "pixel_event_day" (
	"store_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"day" date NOT NULL,
	"event_name" text NOT NULL,
	"origin" text NOT NULL,
	"sent" integer DEFAULT 0 NOT NULL,
	"failed" integer DEFAULT 0 NOT NULL,
	"skipped" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pixel_event_day_connection_id_day_event_name_origin_pk" PRIMARY KEY("connection_id","day","event_name","origin")
);
--> statement-breakpoint
CREATE TABLE "pixel_event_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"event_name" text NOT NULL,
	"origin" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"skip_reason" text,
	"http_status" integer,
	"fbtrace_id" text,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"matched" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"value_paise" integer,
	"order_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	CONSTRAINT "pixel_event_log_origin" CHECK ("pixel_event_log"."origin" in ('storefront','order','test')),
	CONSTRAINT "pixel_event_log_status" CHECK ("pixel_event_log"."status" in ('queued','sent','failed','skipped')),
	CONSTRAINT "pixel_event_log_skip_reason" CHECK ("pixel_event_log"."skip_reason" is null or "pixel_event_log"."skip_reason" in ('no_consent','test_order','imported','too_old','paused','errored','no_tracking')),
	CONSTRAINT "pixel_event_log_error_length" CHECK ("pixel_event_log"."error" is null or length("pixel_event_log"."error") <= 500)
);
--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN "tracking" jsonb;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "tracking" jsonb;--> statement-breakpoint
ALTER TABLE "pixel_connection" ADD CONSTRAINT "pixel_connection_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixel_event_day" ADD CONSTRAINT "pixel_event_day_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixel_event_day" ADD CONSTRAINT "pixel_event_day_connection_id_pixel_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."pixel_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixel_event_log" ADD CONSTRAINT "pixel_event_log_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixel_event_log" ADD CONSTRAINT "pixel_event_log_connection_id_pixel_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."pixel_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pixel_event_log" ADD CONSTRAINT "pixel_event_log_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pixel_connection_store_pixel" ON "pixel_connection" USING btree ("store_id","platform","pixel_id");--> statement-breakpoint
CREATE INDEX "pixel_event_day_store_day" ON "pixel_event_day" USING btree ("store_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "pixel_event_log_event" ON "pixel_event_log" USING btree ("connection_id","event_name","event_id","origin");--> statement-breakpoint
CREATE INDEX "pixel_event_log_store_created" ON "pixel_event_log" USING btree ("store_id","created_at" DESC NULLS LAST);--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- The daily {pixels}-prune's store list (ids only): log and day rows are kept 30 days, and an
-- order's tracking IP and user agent are cleared 30 days after it was placed.
CREATE OR REPLACE FUNCTION stores_with_old_pixel_data(at timestamptz DEFAULT now()) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM pixel_event_log WHERE created_at < at - interval '30 days'
  UNION
  SELECT store_id FROM pixel_event_day WHERE day < (at AT TIME ZONE 'Asia/Kolkata')::date - 30
  UNION
  SELECT store_id FROM "order"
    WHERE tracking IS NOT NULL AND (tracking ? 'ip' OR tracking ? 'ua')
      AND placed_at < at - interval '30 days';
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_old_pixel_data(timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_old_pixel_data(timestamptz) TO app;
--> statement-breakpoint
-- MOVE: each store with a Meta pixel id in Online Store preferences gets the Pixels app and a
-- browser-only pixel with that id (owner, 2026-10-24), so nothing changes for shoppers. The old
-- field is left as it is: the storefront stops reading it once it reads pixel_connection.
UPDATE "store"
SET "apps" = jsonb_set(
  CASE WHEN jsonb_typeof("apps") = 'object' THEN "apps" ELSE '{}'::jsonb END,
  '{installed}',
  CASE WHEN jsonb_typeof("apps"->'installed') = 'array' THEN "apps"->'installed' ELSE '[]'::jsonb END
    || '["pixels"]'::jsonb
)
WHERE btrim(coalesce("preferences"->'tracking'->>'metaPixel', '')) ~ '^[0-9]{10,20}$'
  AND NOT (CASE WHEN jsonb_typeof("apps"->'installed') = 'array' THEN "apps"->'installed' ELSE '[]'::jsonb END ? 'pixels');
--> statement-breakpoint
INSERT INTO "app_installation" ("id", "store_id", "plugin_id", "installed_at")
SELECT gen_random_uuid(), s."id", 'pixels', now() FROM "store" s
WHERE btrim(coalesce(s."preferences"->'tracking'->>'metaPixel', '')) ~ '^[0-9]{10,20}$'
ON CONFLICT ("store_id", "plugin_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "pixel_connection" ("id", "store_id", "platform", "pixel_id", "name")
SELECT gen_random_uuid(), s."id", 'meta', btrim(s."preferences"->'tracking'->>'metaPixel'), 'Meta pixel'
FROM "store" s
WHERE btrim(coalesce(s."preferences"->'tracking'->>'metaPixel', '')) ~ '^[0-9]{10,20}$'
ON CONFLICT ("store_id", "platform", "pixel_id") DO NOTHING;