-- Stores where at least one member turned on the weekly or monthly performance report (Account →
-- Notifications), for the worker's sweep; the sweep then works per store under RLS. Ids only,
-- same pattern as stores_with_member_daily_summaries (0111). Email only, so only `email` counts.
CREATE OR REPLACE FUNCTION stores_with_member_reports() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM store_member
  WHERE status = 'active'
    AND (notification_prefs -> 'weeklyReport' ->> 'email' = 'true'
      OR notification_prefs -> 'monthlyReport' ->> 'email' = 'true');
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_member_reports() FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_member_reports() TO app;
