-- When this member last opened Orders › Drafts. The sidebar counts shoppers' unpaid checkout
-- drafts with activity after it (null: every open one). Nullable, so an older build keeps working.
ALTER TABLE "store_member" ADD COLUMN IF NOT EXISTS "drafts_seen_at" timestamp with time zone;
