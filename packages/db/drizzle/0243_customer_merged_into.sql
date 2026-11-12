-- Customer merge (admin › customer › "Merge with another customer…"): the record that was merged
-- away stays as an erased stub, so its store credit history and audit trail keep their owner, and
-- points at the customer it became. Lists leave it out; its page opens the kept customer.
ALTER TABLE "customer" ADD COLUMN IF NOT EXISTS "merged_into_id" uuid REFERENCES "customer"("id");
