ALTER TABLE "notification" ALTER COLUMN "order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN IF NOT EXISTS "email" text;--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN IF NOT EXISTS "phone" text;--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN IF NOT EXISTS "customer_name" text;--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "cart" ADD COLUMN IF NOT EXISTS "recovery_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN IF NOT EXISTS "cart_id" uuid;--> statement-breakpoint
ALTER TABLE "notification" DROP CONSTRAINT IF EXISTS "notification_cart_id_cart_id_fk";--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "notification_cart_channel_template" ON "notification" USING btree ("cart_id","channel","template") WHERE cart_id is not null;
--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION stores_with_abandoned_carts(cutoff timestamptz) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT c.store_id FROM cart c
  WHERE c.status = 'open' AND c.email IS NOT NULL
    AND c.recovery_sent_at IS NULL AND c.updated_at < cutoff
    AND EXISTS (SELECT 1 FROM cart_line cl WHERE cl.cart_id = c.id);
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_abandoned_carts(timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_abandoned_carts(timestamptz) TO app;
