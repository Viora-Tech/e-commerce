CREATE TABLE "review" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"order_id" uuid,
	"customer_id" uuid,
	"rating" integer NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"reviewer_name" text DEFAULT '' NOT NULL,
	"reviewer_email" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"held_reason" text,
	"verified_buyer" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'storefront' NOT NULL,
	"external_id" text,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"reply" text,
	"reply_at" timestamp with time zone,
	"featured" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"hidden_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_rating_check" CHECK ("review"."rating" between 1 and 5),
	CONSTRAINT "review_status_check" CHECK ("review"."status" in ('pending', 'published', 'hidden')),
	CONSTRAINT "review_source_check" CHECK ("review"."source" in ('storefront', 'judgeme')),
	CONSTRAINT "review_held_reason_check" CHECK ("review"."held_reason" is null or "review"."held_reason" in ('rating', 'photos', 'all'))
);
--> statement-breakpoint
CREATE TABLE "review_media" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"media_id" uuid,
	"source_url" text,
	"copy_error" text,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review_request" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"email" text NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"opted_out_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_media" ADD CONSTRAINT "review_media_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_media" ADD CONSTRAINT "review_media_review_id_review_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."review"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_media" ADD CONSTRAINT "review_media_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_request" ADD CONSTRAINT "review_request_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_request" ADD CONSTRAINT "review_request_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_request" ADD CONSTRAINT "review_request_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "review_store_external" ON "review" USING btree ("store_id","external_id");--> statement-breakpoint
CREATE INDEX "review_store_product_status" ON "review" USING btree ("store_id","product_id","status");--> statement-breakpoint
CREATE INDEX "review_store_status_created" ON "review" USING btree ("store_id","status","created_at");--> statement-breakpoint
CREATE INDEX "review_media_store_review" ON "review_media" USING btree ("store_id","review_id");--> statement-breakpoint
CREATE UNIQUE INDEX "review_request_store_order_product" ON "review_request" USING btree ("store_id","order_id","product_id");--> statement-breakpoint
CREATE INDEX "review_request_store_due" ON "review_request" USING btree ("store_id","due_at");--> statement-breakpoint
CREATE INDEX "review_request_store_email" ON "review_request" USING btree ("store_id",lower("email"));--> statement-breakpoint
-- Store ids with review requests to send or remind, for the worker's review request sweep
-- (the sweep then works per store under RLS). Ids only, same pattern as
-- stores_with_stale_import_snapshots (0087).
CREATE OR REPLACE FUNCTION stores_with_due_review_requests() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM review_request
  WHERE reviewed_at IS NULL AND opted_out_at IS NULL
    AND ((sent_at IS NULL AND due_at <= now()) OR (reminder_sent_at IS NULL AND sent_at > now() - interval '90 days'));
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_due_review_requests() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_due_review_requests() TO app;
--> statement-breakpoint
SELECT apply_store_rls();