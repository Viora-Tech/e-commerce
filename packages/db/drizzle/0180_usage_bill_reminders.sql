ALTER TABLE "usage_bill" ADD COLUMN "reminders_sent" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Stores with a per-order fee bill still waiting for payment, for the reminder emails.
CREATE OR REPLACE FUNCTION stores_with_due_usage_bills() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM usage_bill WHERE status = 'due' AND reminders_sent < 2;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_due_usage_bills() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_due_usage_bills() TO app;
