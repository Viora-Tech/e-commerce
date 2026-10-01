CREATE TABLE "business" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"legal_name" text NOT NULL,
	"trade_name" text,
	"pan" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"payout_mode" text DEFAULT 'main' NOT NULL,
	"razorpay_account_id" text,
	"route_status" text DEFAULT 'none' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "business_payout_mode_check" CHECK ("business"."payout_mode" in ('main', 'razorpay_route')),
	CONSTRAINT "business_route_status_check" CHECK ("business"."route_status" in ('none', 'created', 'under_review', 'activated', 'suspended'))
);
--> statement-breakpoint
CREATE TABLE "gst_registration" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"business_id" uuid NOT NULL,
	"gstin" text NOT NULL,
	"state_code" text GENERATED ALWAYS AS (left(gstin, 2)) STORED NOT NULL,
	"registration_type" text DEFAULT 'regular' NOT NULL,
	"legal_address" jsonb,
	"trade_name" text,
	"email" text,
	"phone" text,
	"invoice_prefix" text,
	"effective_from" date,
	"cancelled_at" timestamp with time zone,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gst_registration_type_check" CHECK ("gst_registration"."registration_type" in ('regular', 'composition')),
	CONSTRAINT "gst_registration_invoice_prefix_check" CHECK ("gst_registration"."invoice_prefix" is null or char_length("gst_registration"."invoice_prefix") <= 5)
);
--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "gst_registration_id" uuid;--> statement-breakpoint
ALTER TABLE "business" ADD CONSTRAINT "business_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gst_registration" ADD CONSTRAINT "gst_registration_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gst_registration" ADD CONSTRAINT "gst_registration_business_id_business_id_fk" FOREIGN KEY ("business_id") REFERENCES "public"."business"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "business_store_pan" ON "business" USING btree ("store_id","pan");--> statement-breakpoint
CREATE UNIQUE INDEX "business_one_primary" ON "business" USING btree ("store_id") WHERE "business"."is_primary";--> statement-breakpoint
CREATE UNIQUE INDEX "gst_registration_store_gstin" ON "gst_registration" USING btree ("store_id","gstin");--> statement-breakpoint
CREATE UNIQUE INDEX "gst_registration_one_default" ON "gst_registration" USING btree ("store_id") WHERE "gst_registration"."is_default";--> statement-breakpoint
CREATE INDEX "gst_registration_business" ON "gst_registration" USING btree ("business_id");--> statement-breakpoint
ALTER TABLE "location" ADD CONSTRAINT "location_gst_registration_id_gst_registration_id_fk" FOREIGN KEY ("gst_registration_id") REFERENCES "public"."gst_registration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- BACKFILL: one primary business and one default GST registration per store, ONLY for stores
-- whose store.gstin is well formed: a business needs a PAN, and the GSTIN is the only PAN we
-- hold. Stores without a GSTIN get neither; they add one in Settings > Business and GST.
-- Shape is checked here, not the checksum; the app validated the checksum when it was saved.
-- Legal name and address: the GST invoices app's seller block when filled in (that is the
-- Taxes & GST page's "registered address"), else the store name and store.address.
-- store.gstin stays: it mirrors the default registration from now on. Safe to run twice.
INSERT INTO "business" ("id", "store_id", "legal_name", "pan", "is_primary")
SELECT gen_random_uuid(), s."id",
       coalesce(nullif(trim(inv."settings"->'seller'->>'legalName'), ''), s."name"),
       substr(upper(trim(s."gstin")), 3, 10), true
FROM "store" s
LEFT JOIN "invoice_settings" inv ON inv."store_id" = s."id"
WHERE upper(trim(s."gstin")) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  AND NOT EXISTS (SELECT 1 FROM "business" b WHERE b."store_id" = s."id");--> statement-breakpoint
INSERT INTO "gst_registration" ("id", "store_id", "business_id", "gstin", "legal_address", "is_default")
SELECT gen_random_uuid(), s."id", b."id", upper(trim(s."gstin")),
       CASE
         WHEN coalesce(trim(inv."settings"->'seller'->>'line1'), '') <> '' THEN jsonb_build_object(
           'line1', inv."settings"->'seller'->>'line1',
           'line2', coalesce(inv."settings"->'seller'->>'line2', ''),
           'city', coalesce(inv."settings"->'seller'->>'city', ''),
           'pincode', coalesce(inv."settings"->'seller'->>'pincode', ''))
         WHEN s."address" IS NOT NULL THEN jsonb_build_object(
           'line1', coalesce(s."address"->>'line1', ''),
           'line2', coalesce(s."address"->>'line2', ''),
           'city', coalesce(s."address"->>'city', ''),
           'pincode', coalesce(s."address"->>'pincode', ''))
       END,
       true
FROM "store" s
JOIN "business" b ON b."store_id" = s."id" AND b."is_primary"
LEFT JOIN "invoice_settings" inv ON inv."store_id" = s."id"
WHERE upper(trim(s."gstin")) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$'
  AND NOT EXISTS (SELECT 1 FROM "gst_registration" r WHERE r."store_id" = s."id");--> statement-breakpoint
UPDATE "store" SET "gstin" = upper(trim("gstin"))
WHERE upper(trim("gstin")) ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' AND "gstin" <> upper(trim("gstin"));--> statement-breakpoint
SELECT apply_store_rls();
