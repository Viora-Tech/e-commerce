-- Indexes for the admin's list pages, Home and the order page (perf audit, Nov 2026). Rows are
-- scoped by RLS (`app.store_id`), so a read without an index that starts with store_id reads
-- every store's rows. Each is small and builds in well under a second at today's sizes.
CREATE INDEX IF NOT EXISTS "customer_store_created" ON "customer" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_store_created" ON "product" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "order_store_test" ON "order" USING btree ("store_id") WHERE "order"."is_test";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_level_store_sellable" ON "inventory_level" USING btree ("store_id","variant_id") WHERE "inventory_level"."fulfils_online";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "inventory_adjustment_store_created" ON "inventory_adjustment" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "refund_store_created" ON "refund" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_store_provider_created" ON "payment" USING btree ("store_id","provider","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_event_store_received" ON "payment_event" USING btree ("store_id","received_at");
