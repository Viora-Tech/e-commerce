CREATE TABLE "rollout_ab_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"rollout_id" uuid NOT NULL,
	"visitor_id" text NOT NULL,
	"arm" text NOT NULL,
	"kind" text NOT NULL,
	"order_id" uuid,
	"value_minor" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rollout_ab_event_arm" CHECK ("rollout_ab_event"."arm" in ('control', 'treatment')),
	CONSTRAINT "rollout_ab_event_kind" CHECK ("rollout_ab_event"."kind" in ('exposure', 'add_to_cart', 'purchase'))
);
--> statement-breakpoint
ALTER TABLE "rollout" ADD COLUMN "notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "rollout" ADD COLUMN "audience" jsonb;--> statement-breakpoint
ALTER TABLE "rollout" ADD COLUMN "ab_outcome" text;--> statement-breakpoint
ALTER TABLE "rollout_ab_event" ADD CONSTRAINT "rollout_ab_event_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollout_ab_event" ADD CONSTRAINT "rollout_ab_event_rollout_id_rollout_id_fk" FOREIGN KEY ("rollout_id") REFERENCES "public"."rollout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rollout_ab_event_rollout" ON "rollout_ab_event" USING btree ("rollout_id","kind","arm");--> statement-breakpoint
CREATE UNIQUE INDEX "rollout_ab_event_once" ON "rollout_ab_event" USING btree ("rollout_id","visitor_id","kind") WHERE "rollout_ab_event"."kind" <> 'purchase';--> statement-breakpoint
CREATE UNIQUE INDEX "rollout_ab_event_order" ON "rollout_ab_event" USING btree ("rollout_id","order_id") WHERE "rollout_ab_event"."kind" = 'purchase';--> statement-breakpoint
ALTER TABLE "rollout" ADD CONSTRAINT "rollout_ab_outcome" CHECK ("rollout"."ab_outcome" in ('treatment', 'control'));--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- A/B rollouts: a running test picks the theme its Treatment visitors see, so starting, pausing
-- or ending one drops the store's cached pages like a theme publish does.
DROP TRIGGER IF EXISTS storefront_cache_notify ON "rollout";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "rollout"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();
