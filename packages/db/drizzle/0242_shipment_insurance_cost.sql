-- What a shipment's insurance costs, worked out at booking (Delhivery Protect for the parcel's
-- products, or the route's insurance rate): 0 when not insured, null when unknown. The order
-- page's shipping margin subtracts it. Nullable, no default: older shipments stay unknown.
ALTER TABLE "shipment" ADD COLUMN IF NOT EXISTS "insurance_paise" integer;
