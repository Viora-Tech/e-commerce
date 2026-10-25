ALTER TABLE "store_member" ADD COLUMN "notification_prefs" jsonb;--> statement-breakpoint
-- Stores where at least one member asked for a daily summary (Account → Notifications), for
-- the worker's sweep; the sweep then works per store under RLS. Ids only, same pattern as
-- stores_with_due_review_requests (0091).
CREATE OR REPLACE FUNCTION stores_with_member_daily_summaries() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM store_member
  WHERE status = 'active'
    AND (notification_prefs -> 'dailySummary' ->> 'email' = 'true'
      OR notification_prefs -> 'dailySummary' ->> 'whatsapp' = 'true');
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_member_daily_summaries() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_member_daily_summaries() TO app;
