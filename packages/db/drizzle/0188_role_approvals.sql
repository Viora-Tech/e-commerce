CREATE TABLE "role_approval" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"permission" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_action" DROP CONSTRAINT "ai_action_source_check";--> statement-breakpoint
ALTER TABLE "ai_action" ADD COLUMN "needs_approver" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_action" ADD COLUMN "permission" text;--> statement-breakpoint
ALTER TABLE "ai_action" ADD COLUMN "outcome_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "role_approval" ADD CONSTRAINT "role_approval_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_approval" ADD CONSTRAINT "role_approval_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "role_approval_role_permission" ON "role_approval" USING btree ("role_id","permission");--> statement-breakpoint
CREATE INDEX "ai_action_store_waiting" ON "ai_action" USING btree ("store_id","needs_approver","status");--> statement-breakpoint
ALTER TABLE "ai_action" ADD CONSTRAINT "ai_action_source_check" CHECK ("ai_action"."source" in ('assistant', 'bulkWriter', 'mcp', 'admin', 'api'));
--> statement-breakpoint
SELECT apply_store_rls();
--> statement-breakpoint
-- Payment keys and payouts split out of settings.manage: every role that changes settings
-- keeps changing payments. Owners hold every permission.
INSERT INTO "role_permission" ("id", "store_id", "role_id", "permission")
SELECT gen_random_uuid(), r."store_id", r."id", 'payments.manage'
FROM "role" r
WHERE r."slug" <> 'owner' AND EXISTS (
  SELECT 1 FROM "role_permission" rp
  WHERE rp."role_id" = r."id" AND rp."permission" = 'settings.manage'
)
ON CONFLICT ("role_id", "permission") DO NOTHING;
--> statement-breakpoint
-- Approving other members' changes: the built-in Administrator.
INSERT INTO "role_permission" ("id", "store_id", "role_id", "permission")
SELECT gen_random_uuid(), r."store_id", r."id", 'approvals.manage'
FROM "role" r
WHERE r."is_system" AND r."slug" = 'admin'
ON CONFLICT ("role_id", "permission") DO NOTHING;
--> statement-breakpoint
-- "Needs approval" starts ticked on money, deletes, payment keys, billing, staff and
-- discounts for every role but the owner (DEFAULT_APPROVAL_PERMISSIONS).
INSERT INTO "role_approval" ("id", "store_id", "role_id", "permission")
SELECT gen_random_uuid(), r."store_id", r."id", p.permission
FROM "role" r
CROSS JOIN (VALUES ('orders.refund'), ('orders.cancel'), ('products.delete'),
  ('customers.delete'), ('discounts.write'), ('payments.manage'), ('staff.invite'),
  ('staff.manage'), ('billing.manage')) AS p(permission)
WHERE r."slug" <> 'owner'
ON CONFLICT ("role_id", "permission") DO NOTHING;
--> statement-breakpoint
-- The store-wide "Changes need approval" MCP switch is retired: MCP changes run with the
-- connecting member's role (a role's "Needs approval" ticks queue them instead).
UPDATE "store"
SET "preferences" = jsonb_set("preferences", '{mcp}', ("preferences"->'mcp') - 'requireApproval')
WHERE jsonb_typeof("preferences"->'mcp') = 'object' AND ("preferences"->'mcp') ? 'requireApproval';
