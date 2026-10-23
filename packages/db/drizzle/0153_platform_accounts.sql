CREATE TABLE "platform_account" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"platform" text NOT NULL,
	"external_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_event_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "platform_account_platform_check" CHECK ("platform_account"."platform" in ('meta','whatsapp','shopify'))
);
--> statement-breakpoint
ALTER TABLE "platform_account" ADD CONSTRAINT "platform_account_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "platform_account_store" ON "platform_account" USING btree ("store_id","platform");--> statement-breakpoint
CREATE INDEX "platform_account_external" ON "platform_account" USING btree ("platform","external_id");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- The stores behind an outside platform's account id, for callbacks that name no store
-- (Meta's data deletion and deauthorize, WhatsApp and Shopify webhooks).
CREATE OR REPLACE FUNCTION stores_for_platform_account(p_platform text, p_external_id text) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM platform_account WHERE platform = p_platform AND external_id = p_external_id;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_for_platform_account(text, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_for_platform_account(text, text) TO app;