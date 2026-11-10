-- Which checkout drafts each member has opened, so the sidebar's Drafts count drops by one per
-- draft opened (owner, 10 Nov 2026) instead of clearing when the list is opened. A new table, so an
-- older build that never reads it keeps working during a rolling deploy.
CREATE TABLE IF NOT EXISTS "draft_seen" (
	"store_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"order_id" uuid NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "draft_seen" ADD CONSTRAINT "draft_seen_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "draft_seen" ADD CONSTRAINT "draft_seen_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "draft_seen_user_order" ON "draft_seen" USING btree ("store_id","user_id","order_id");
--> statement-breakpoint
SELECT apply_store_rls();
