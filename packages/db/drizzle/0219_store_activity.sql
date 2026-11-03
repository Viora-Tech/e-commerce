CREATE TABLE "store_activity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"actor_user_id" text,
	"actor_name" text,
	"actor_email" text,
	"source" text NOT NULL,
	"action" text NOT NULL,
	"area" text NOT NULL,
	"resource_type" text,
	"resource_id" text,
	"summary" text NOT NULL,
	"changes" jsonb,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "store_activity_source" CHECK ("store_activity"."source" in ('admin','assistant','mcp','api','worker','storefront'))
);
--> statement-breakpoint
ALTER TABLE "store_activity" ADD CONSTRAINT "store_activity_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "store_activity_store" ON "store_activity" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX "store_activity_actor" ON "store_activity" USING btree ("store_id","actor_user_id","created_at");--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- Stores with activity log rows older than the year the log keeps (the worker's daily prune).
CREATE OR REPLACE FUNCTION stores_with_old_store_activity(at timestamptz DEFAULT now()) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM store_activity WHERE created_at < at - interval '365 days';
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_old_store_activity(timestamptz) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_old_store_activity(timestamptz) TO app;
--> statement-breakpoint
-- Settings → Activity log: the built-in Administrator reads it. Owners hold every permission.
INSERT INTO "role_permission" ("id", "store_id", "role_id", "permission")
SELECT gen_random_uuid(), r."store_id", r."id", 'activity.read'
FROM "role" r
WHERE r."is_system" AND r."slug" = 'admin'
ON CONFLICT ("role_id", "permission") DO NOTHING;
