-- GST phase 2 + 3: the order's GSTIN (tax origin), invoices numbered per GSTIN, per-location
-- courier pickup. New columns only; no new tables.
DROP INDEX "invoice_period_store";--> statement-breakpoint
DROP INDEX "invoice_sequence_series_fy";--> statement-breakpoint
DROP INDEX "invoice_number_unique";--> statement-breakpoint
ALTER TABLE "location" ADD COLUMN "courier_pickup" jsonb;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "gst_registration_id" uuid;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "tax_origin" jsonb;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "gst_registration_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_period" ADD COLUMN "gst_registration_id" uuid;--> statement-breakpoint
ALTER TABLE "invoice_sequence" ADD COLUMN "gst_registration_id" uuid;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_gst_registration_id_gst_registration_id_fk" FOREIGN KEY ("gst_registration_id") REFERENCES "public"."gst_registration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_gst_registration_id_gst_registration_id_fk" FOREIGN KEY ("gst_registration_id") REFERENCES "public"."gst_registration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_period" ADD CONSTRAINT "invoice_period_gst_registration_id_gst_registration_id_fk" FOREIGN KEY ("gst_registration_id") REFERENCES "public"."gst_registration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_sequence" ADD CONSTRAINT "invoice_sequence_gst_registration_id_gst_registration_id_fk" FOREIGN KEY ("gst_registration_id") REFERENCES "public"."gst_registration"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_number_unique" ON "invoice" USING btree ("store_id",coalesce("gst_registration_id", '00000000-0000-0000-0000-000000000000'::uuid),"fy_start_year","number") WHERE "invoice"."number" is not null;--> statement-breakpoint
ALTER TABLE "invoice_period" ADD CONSTRAINT "invoice_period_store" UNIQUE NULLS NOT DISTINCT("store_id","gst_registration_id","period");--> statement-breakpoint
ALTER TABLE "invoice_sequence" ADD CONSTRAINT "invoice_sequence_series_fy" UNIQUE NULLS NOT DISTINCT("store_id","gst_registration_id","series_id","fy_start_year");--> statement-breakpoint
-- ADOPTION: GST numbering, return months and documents are per GSTIN. Rows written while a
-- store had no GST registration carry a null gst_registration_id; whichever registration
-- becomes the store's default adopts them, so the first GSTIN continues the same series
-- instead of starting again at 1. Counters and months the registration already has are
-- merged (higher next number; filed and closed kept). An issued number the registration
-- already used stays unassigned rather than break rule 46(b) uniqueness.
CREATE OR REPLACE FUNCTION adopt_unassigned_gst_documents(p_store uuid, p_registration uuid)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "invoice_sequence" r SET "next" = greatest(r."next", n."next")
    FROM "invoice_sequence" n
   WHERE r."store_id" = p_store AND r."gst_registration_id" = p_registration
     AND n."store_id" = p_store AND n."gst_registration_id" IS NULL
     AND n."series_id" = r."series_id" AND n."fy_start_year" = r."fy_start_year";
  DELETE FROM "invoice_sequence" n
   WHERE n."store_id" = p_store AND n."gst_registration_id" IS NULL
     AND EXISTS (SELECT 1 FROM "invoice_sequence" r
                  WHERE r."store_id" = p_store AND r."gst_registration_id" = p_registration
                    AND r."series_id" = n."series_id" AND r."fy_start_year" = n."fy_start_year");
  UPDATE "invoice_sequence" SET "gst_registration_id" = p_registration
   WHERE "store_id" = p_store AND "gst_registration_id" IS NULL;

  UPDATE "invoice_period" r
     SET "gstr1_filed_at" = coalesce(r."gstr1_filed_at", n."gstr1_filed_at"),
         "closed_at" = coalesce(r."closed_at", n."closed_at")
    FROM "invoice_period" n
   WHERE r."store_id" = p_store AND r."gst_registration_id" = p_registration
     AND n."store_id" = p_store AND n."gst_registration_id" IS NULL AND n."period" = r."period";
  DELETE FROM "invoice_period" n
   WHERE n."store_id" = p_store AND n."gst_registration_id" IS NULL
     AND EXISTS (SELECT 1 FROM "invoice_period" r
                  WHERE r."store_id" = p_store AND r."gst_registration_id" = p_registration
                    AND r."period" = n."period");
  UPDATE "invoice_period" SET "gst_registration_id" = p_registration
   WHERE "store_id" = p_store AND "gst_registration_id" IS NULL;

  UPDATE "invoice" i SET "gst_registration_id" = p_registration
   WHERE i."store_id" = p_store AND i."gst_registration_id" IS NULL
     AND (i."number" IS NULL OR NOT EXISTS (
           SELECT 1 FROM "invoice" o
            WHERE o."store_id" = p_store AND o."gst_registration_id" = p_registration
              AND o."fy_start_year" IS NOT DISTINCT FROM i."fy_start_year"
              AND o."number" = i."number"));
END;
$$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION gst_registration_adopt_unassigned() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM adopt_unassigned_gst_documents(NEW."store_id", NEW."id");
  RETURN NEW;
END;
$$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "gst_registration_adopt_unassigned" ON "gst_registration";--> statement-breakpoint
CREATE TRIGGER "gst_registration_adopt_unassigned"
  AFTER INSERT OR UPDATE OF "is_default" ON "gst_registration"
  FOR EACH ROW WHEN (NEW."is_default") EXECUTE FUNCTION gst_registration_adopt_unassigned();--> statement-breakpoint
-- BACKFILL: every existing invoice, counter and return month belongs to the store's default
-- registration (0080 made one for every store with a well-formed GSTIN). Stores without a
-- registration keep null until their first GSTIN (the trigger above). Orders are not
-- backfilled: an order without gst_registration_id is billed from the default registration.
-- Safe to run twice.
SELECT adopt_unassigned_gst_documents(r."store_id", r."id")
  FROM "gst_registration" r WHERE r."is_default";--> statement-breakpoint
SELECT apply_store_rls();
