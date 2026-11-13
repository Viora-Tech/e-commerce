-- Plan changes are prorated (Figma 931:11086 "Move to Pro?"): an upgrade bills the new plan for
-- the rest of the period less the old plan's unused days. `prorated` marks such a bill so paying
-- it keeps its period end (the renewal date does not move); `credit_paise` records what was taken
-- off, before GST. Existing bills are full periods with no credit. The table's RLS (store_id)
-- already covers the new columns.
ALTER TABLE "plan_payment" ADD COLUMN IF NOT EXISTS "prorated" boolean DEFAULT false NOT NULL;
ALTER TABLE "plan_payment" ADD COLUMN IF NOT EXISTS "credit_paise" integer DEFAULT 0 NOT NULL;
