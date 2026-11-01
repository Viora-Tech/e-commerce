-- Who changed the stock (audit #139). Filled by the column default from the request's
-- `app.actor_name` (set by the admin API for the signed-in member); null for system writes
-- (orders, imports) and rows written before this.
ALTER TABLE "inventory_adjustment" ADD COLUMN "actor_name" text DEFAULT nullif(current_setting('app.actor_name', true), '');
