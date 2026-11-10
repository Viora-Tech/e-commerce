-- Whether checkout names this courier to shoppers ("Express · Blue Dart"). Null keeps the default
-- (shown); the merchant turns it off per courier in Delivery options. Nullable: older builds ignore it.
ALTER TABLE "delivery_route_setting" ADD COLUMN IF NOT EXISTS "show_name" boolean;
