ALTER TABLE "order" ADD COLUMN "draft_number" integer;--> statement-breakpoint
-- Drafts get their own series (#D1, #D2 ... per store, audit #26). Every existing draft, and every
-- order that started as one (tagged `draft`), is numbered D1..Dn by creation order (ids are
-- uuidv7). Their order numbers stay as they are: converted orders keep theirs, and a draft that
-- already reserved one keeps it when it converts. Only drafts saved from now on wait for one.
UPDATE "order" o SET "draft_number" = d.n
FROM (
  SELECT "id", row_number() OVER (PARTITION BY "store_id" ORDER BY "id") AS n
  FROM "order"
  WHERE "status" = 'draft' OR 'draft' = ANY("tags")
) d
WHERE o."id" = d."id";--> statement-breakpoint
CREATE UNIQUE INDEX "order_store_draft_number" ON "order" USING btree ("store_id","draft_number") WHERE "order"."draft_number" is not null;--> statement-breakpoint
-- The draft counter starts after the backfilled drafts.
INSERT INTO "store_counter" ("id", "store_id", "name", "value")
SELECT gen_random_uuid(), "store_id", 'draft', max("draft_number") + 1
FROM "order" WHERE "draft_number" IS NOT NULL
GROUP BY "store_id"
ON CONFLICT ("store_id", "name") DO NOTHING;
