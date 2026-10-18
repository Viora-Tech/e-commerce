CREATE TABLE "ai_credit_topup" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"credits" integer NOT NULL,
	"status" text DEFAULT 'due' NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"sales_order_number" integer NOT NULL,
	"amount_paise" integer NOT NULL,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_credit_topup_status" CHECK ("ai_credit_topup"."status" in ('due','paid','cancelled'))
);
--> statement-breakpoint
ALTER TABLE "ai_settings" ADD COLUMN "extra_credit_millis" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "credit_millis" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_credit_topup" ADD CONSTRAINT "ai_credit_topup_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_credit_topup_store" ON "ai_credit_topup" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_credit_topup_order" ON "ai_credit_topup" USING btree ("sales_order_id");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- The store an AI credit top-up belongs to, for the sales store's order.paid hook.
CREATE OR REPLACE FUNCTION ai_credit_topup_store(sales_order uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT store_id FROM ai_credit_topup WHERE sales_order_id = sales_order;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION ai_credit_topup_store(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION ai_credit_topup_store(uuid) TO app;
