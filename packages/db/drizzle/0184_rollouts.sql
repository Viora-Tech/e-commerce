CREATE TABLE "rollout" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'launch' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"end_action" text DEFAULT 'rollback' NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"error" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rollout_kind" CHECK ("rollout"."kind" in ('launch', 'event')),
	CONSTRAINT "rollout_status" CHECK ("rollout"."status" in ('draft', 'scheduled', 'active', 'paused', 'ended', 'archived')),
	CONSTRAINT "rollout_end_action" CHECK ("rollout"."end_action" in ('rollback', 'apply')),
	CONSTRAINT "rollout_event_end" CHECK ("rollout"."kind" <> 'event' or "rollout"."ends_at" is null or "rollout"."starts_at" is null or "rollout"."ends_at" > "rollout"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "rollout_change" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"rollout_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"target_id" uuid,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"previous" jsonb,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rollout_change_kind" CHECK ("rollout_change"."kind" in ('theme', 'checkout_branding', 'discount')),
	CONSTRAINT "rollout_change_target" CHECK (("rollout_change"."kind" = 'checkout_branding') = ("rollout_change"."target_id" is null))
);
--> statement-breakpoint
ALTER TABLE "rollout" ADD CONSTRAINT "rollout_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollout_change" ADD CONSTRAINT "rollout_change_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rollout_change" ADD CONSTRAINT "rollout_change_rollout_id_rollout_id_fk" FOREIGN KEY ("rollout_id") REFERENCES "public"."rollout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rollout_due" ON "rollout" USING btree ("status","starts_at","ends_at");--> statement-breakpoint
CREATE INDEX "rollout_store" ON "rollout" USING btree ("store_id","status");--> statement-breakpoint
CREATE INDEX "rollout_change_rollout" ON "rollout_change" USING btree ("rollout_id");--> statement-breakpoint
CREATE INDEX "rollout_change_target" ON "rollout_change" USING btree ("store_id","kind","target_id");--> statement-breakpoint
CREATE UNIQUE INDEX "rollout_change_one_branding" ON "rollout_change" USING btree ("rollout_id") WHERE "rollout_change"."kind" = 'checkout_branding';--> statement-breakpoint
CREATE UNIQUE INDEX "rollout_change_one_theme" ON "rollout_change" USING btree ("rollout_id") WHERE "rollout_change"."kind" = 'theme';--> statement-breakpoint
CREATE UNIQUE INDEX "rollout_change_discount_once" ON "rollout_change" USING btree ("rollout_id","target_id") WHERE "rollout_change"."kind" = 'discount';--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
DROP TRIGGER IF EXISTS touch_updated_at ON "rollout";--> statement-breakpoint
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON "rollout" FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
--> statement-breakpoint
-- Stores with a rollout to start (scheduled, its time reached) or an event to end, for the
-- worker's tick (`{rollouts}-tick`), across stores without opening each one.
CREATE OR REPLACE FUNCTION stores_with_rollouts_due(p_at timestamptz) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM rollout
   WHERE (status = 'scheduled' AND starts_at <= p_at)
      OR (status = 'active' AND kind = 'event' AND ends_at <= p_at);
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_rollouts_due(timestamptz) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_rollouts_due(timestamptz) TO app;

--> statement-breakpoint
-- The new `rollouts` permission: system admins get all of it; a role that changes settings can
-- manage rollouts, and one that reads settings can see them. Owners hold every permission.
INSERT INTO "role_permission" ("id", "store_id", "role_id", "permission")
SELECT gen_random_uuid(), r."store_id", r."id", p.permission
FROM "role" r
CROSS JOIN (VALUES ('rollouts.read'), ('rollouts.manage')) AS p(permission)
WHERE r."slug" <> 'owner' AND ((r."is_system" AND r."slug" = 'admin') OR EXISTS (
  SELECT 1 FROM "role_permission" rp
  WHERE rp."role_id" = r."id" AND rp."permission" = 'settings.manage'
))
ON CONFLICT ("role_id", "permission") DO NOTHING;
--> statement-breakpoint
INSERT INTO "role_permission" ("id", "store_id", "role_id", "permission")
SELECT gen_random_uuid(), r."store_id", r."id", 'rollouts.read'
FROM "role" r
WHERE r."slug" <> 'owner' AND EXISTS (
  SELECT 1 FROM "role_permission" rp
  WHERE rp."role_id" = r."id" AND rp."permission" = 'settings.read'
)
ON CONFLICT ("role_id", "permission") DO NOTHING;
