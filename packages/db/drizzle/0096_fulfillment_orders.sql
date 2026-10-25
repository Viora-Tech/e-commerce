CREATE TABLE "fulfillment_order" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"gst_registration_id" uuid,
	"position" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fulfillment_order_status_check" CHECK ("fulfillment_order"."status" in ('open', 'on_hold', 'fulfilled', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "fulfillment_order_line" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"fulfillment_order_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"fulfilled_quantity" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "fulfillment_order_line_quantity_check" CHECK ("fulfillment_order_line"."quantity" > 0),
	CONSTRAINT "fulfillment_order_line_fulfilled_check" CHECK ("fulfillment_order_line"."fulfilled_quantity" >= 0 and "fulfillment_order_line"."fulfilled_quantity" <= "fulfillment_order_line"."quantity")
);
--> statement-breakpoint
ALTER TABLE "shipment" ADD COLUMN "fulfillment_order_id" uuid;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD CONSTRAINT "fulfillment_order_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD CONSTRAINT "fulfillment_order_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD CONSTRAINT "fulfillment_order_location_id_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_order" ADD CONSTRAINT "fulfillment_order_gst_registration_id_gst_registration_id_fk" FOREIGN KEY ("gst_registration_id") REFERENCES "public"."gst_registration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_order_line" ADD CONSTRAINT "fulfillment_order_line_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_order_line" ADD CONSTRAINT "fulfillment_order_line_fulfillment_order_id_fulfillment_order_id_fk" FOREIGN KEY ("fulfillment_order_id") REFERENCES "public"."fulfillment_order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_order_line" ADD CONSTRAINT "fulfillment_order_line_order_line_id_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fulfillment_order_position" ON "fulfillment_order" USING btree ("order_id","position");--> statement-breakpoint
CREATE INDEX "fulfillment_order_store_order" ON "fulfillment_order" USING btree ("store_id","order_id");--> statement-breakpoint
CREATE INDEX "fulfillment_order_store_location" ON "fulfillment_order" USING btree ("store_id","location_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "fulfillment_order_line_unique" ON "fulfillment_order_line" USING btree ("fulfillment_order_id","order_line_id");--> statement-breakpoint
CREATE INDEX "fulfillment_order_line_order_line" ON "fulfillment_order_line" USING btree ("order_line_id");--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_fulfillment_order_id_fulfillment_order_id_fk" FOREIGN KEY ("fulfillment_order_id") REFERENCES "public"."fulfillment_order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipment_fulfillment_order" ON "shipment" USING btree ("fulfillment_order_id");--> statement-breakpoint
SELECT apply_store_rls();--> statement-breakpoint
-- BACKFILL: every placed order with goods gets its fulfilment orders, one per location its
-- lines sell from (in practice the default location: until now only it sold online). Ids are
-- derived from the order and location, so running this again adds nothing.
SELECT ensure_default_location(s."id") FROM "store" s
WHERE EXISTS (SELECT 1 FROM "order" o WHERE o."store_id" = s."id" AND o."status" <> 'draft');--> statement-breakpoint
INSERT INTO "fulfillment_order" ("id", "store_id", "order_id", "location_id", "gst_registration_id", "position", "status")
SELECT
  md5('fo:' || g."order_id" || ':' || g."location_id")::uuid,
  g."store_id",
  g."order_id",
  g."location_id",
  o."gst_registration_id",
  row_number() OVER (PARTITION BY g."order_id" ORDER BY bool_or(l."is_default") DESC, g."location_id"),
  CASE
    WHEN o."status" = 'cancelled' THEN 'cancelled'
    WHEN bool_and(g."fulfilled" >= g."quantity") THEN 'fulfilled'
    ELSE 'open'
  END
FROM (
  SELECT ol."store_id", ol."order_id", ol."quantity", LEAST(ol."fulfilled_quantity", ol."quantity") AS "fulfilled",
    COALESCE(lv."location_id", dl."id") AS "location_id"
  FROM "order_line" ol
  JOIN "order" o ON o."id" = ol."order_id"
  JOIN "location" dl ON dl."store_id" = ol."store_id" AND dl."is_default"
  LEFT JOIN "inventory_level" lv ON lv."variant_id" = ol."variant_id" AND lv."fulfils_online"
  WHERE o."status" <> 'draft' AND NOT ol."gift_card" AND ol."quantity" > 0
) g
JOIN "order" o ON o."id" = g."order_id"
JOIN "location" l ON l."id" = g."location_id"
WHERE NOT EXISTS (SELECT 1 FROM "fulfillment_order" f WHERE f."order_id" = g."order_id")
GROUP BY g."store_id", g."order_id", g."location_id", o."gst_registration_id", o."status";--> statement-breakpoint
INSERT INTO "fulfillment_order_line" ("id", "store_id", "fulfillment_order_id", "order_line_id", "quantity", "fulfilled_quantity")
SELECT
  md5('fol:' || ol."id")::uuid,
  ol."store_id",
  f."id",
  ol."id",
  ol."quantity",
  LEAST(ol."fulfilled_quantity", ol."quantity")
FROM "order_line" ol
JOIN "order" o ON o."id" = ol."order_id"
JOIN "location" dl ON dl."store_id" = ol."store_id" AND dl."is_default"
LEFT JOIN "inventory_level" lv ON lv."variant_id" = ol."variant_id" AND lv."fulfils_online"
JOIN "fulfillment_order" f ON f."id" = md5('fo:' || ol."order_id" || ':' || COALESCE(lv."location_id", dl."id"))::uuid
WHERE o."status" <> 'draft' AND NOT ol."gift_card" AND ol."quantity" > 0
ON CONFLICT DO NOTHING;--> statement-breakpoint
-- A shipment of an order with one parcel carried that parcel.
UPDATE "shipment" s SET "fulfillment_order_id" = f."id"
FROM "fulfillment_order" f
WHERE f."order_id" = s."order_id" AND s."fulfillment_order_id" IS NULL
  AND (SELECT count(*) FROM "fulfillment_order" x WHERE x."order_id" = s."order_id") = 1;
