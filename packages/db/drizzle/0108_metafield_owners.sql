ALTER TABLE "metafield_definition" DROP CONSTRAINT "metafield_definition_owner";--> statement-breakpoint
ALTER TABLE "metafield_definition" ADD CONSTRAINT "metafield_definition_owner" CHECK ("metafield_definition"."owner_type" in ('product', 'variant', 'collection', 'customer', 'order', 'page', 'article', 'shop'));
--> statement-breakpoint
-- BACKFILL: `content.manage_types` (who may add, change and delete content types and extra fields) goes to
-- every role that could do that before: content types needed content.write, extra fields
-- settings.manage. The system Administrator role gets it too, as new stores seed it.
INSERT INTO "role_permission" ("id", "store_id", "role_id", "permission")
SELECT gen_random_uuid(), r."store_id", r."id", 'content.manage_types'
FROM "role" r
WHERE (r."is_system" AND r."slug" = 'admin')
  OR EXISTS (
    SELECT 1 FROM "role_permission" rp
    WHERE rp."role_id" = r."id" AND rp."permission" IN ('content.write', 'settings.manage')
  )
ON CONFLICT ("role_id", "permission") DO NOTHING;
