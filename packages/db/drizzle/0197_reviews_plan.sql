CREATE TABLE "review_question" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"customer_id" uuid,
	"question" text NOT NULL,
	"asker_name" text DEFAULT '' NOT NULL,
	"asker_email" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"answer" text,
	"answered_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_question_status_check" CHECK ("review_question"."status" in ('pending', 'published', 'hidden'))
);
--> statement-breakpoint
CREATE TABLE "review_summary" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"review_count" integer DEFAULT 0 NOT NULL,
	"stale" boolean DEFAULT true NOT NULL,
	"error" text,
	"generated_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "review_request" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "reward_code" text;--> statement-breakpoint
ALTER TABLE "review" ADD COLUMN "reward_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "review_request" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "review_question" ADD CONSTRAINT "review_question_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_question" ADD CONSTRAINT "review_question_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_question" ADD CONSTRAINT "review_question_customer_id_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_summary" ADD CONSTRAINT "review_summary_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_summary" ADD CONSTRAINT "review_summary_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "review_question_store_product_status" ON "review_question" USING btree ("store_id","product_id","status");--> statement-breakpoint
CREATE INDEX "review_question_store_status_created" ON "review_question" USING btree ("store_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "review_summary_store_product" ON "review_summary" USING btree ("store_id","product_id");--> statement-breakpoint
CREATE INDEX "review_summary_store_stale" ON "review_summary" USING btree ("store_id","stale");--> statement-breakpoint
-- Store ids with an AI review summary to (re)write, for the worker's summary sweep (Reviews
-- app); the sweep then works per store under RLS and skips stores that turned summaries off.
CREATE OR REPLACE FUNCTION stores_with_stale_review_summaries() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM review_summary WHERE stale;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_stale_review_summaries() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_stale_review_summaries() TO app;
--> statement-breakpoint
SELECT apply_store_rls();
