-- "Report a bug" status: each report a member files is kept beside its GitHub issue, so the
-- reporter sees its status and the team's reply in the admin (Account → Bug reports). Additive.
CREATE TABLE IF NOT EXISTS "bug_report" (
	"id" uuid PRIMARY KEY NOT NULL,
	"store_id" uuid NOT NULL,
	"reporter_user_id" text NOT NULL,
	"reporter_email" text NOT NULL,
	"reporter_name" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"page" text DEFAULT '' NOT NULL,
	"screenshot_url" text,
	"github_issue_number" integer,
	"github_issue_url" text,
	"status" text DEFAULT 'received' NOT NULL,
	"staff_reply" text,
	"staff_reply_at" timestamp with time zone,
	"staff_reply_comment_id" text,
	"fix_commit_sha" text,
	"closed_at" timestamp with time zone,
	"live_at" timestamp with time zone,
	"status_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reporter_seen_at" timestamp with time zone,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bug_report_status_check" CHECK ("bug_report"."status" in ('received','in_progress','fixed','live','wont_fix'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bug_report" ADD CONSTRAINT "bug_report_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_report_reporter" ON "bug_report" USING btree ("store_id","reporter_user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_report_store_created" ON "bug_report" USING btree ("store_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bug_report_issue" ON "bug_report" USING btree ("github_issue_number");--> statement-breakpoint
SELECT apply_store_rls();--> statement-breakpoint
-- The stores behind a GitHub issue number, for the GitHub webhook (which names no store).
-- Ids only, like stores_for_platform_account (0153).
CREATE OR REPLACE FUNCTION bug_report_stores_for_issue(p_issue integer) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM bug_report WHERE github_issue_number = p_issue;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION bug_report_stores_for_issue(integer) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION bug_report_stores_for_issue(integer) TO app;--> statement-breakpoint
-- Stores with reports: every one (the platform console), or only those whose issue may still
-- change (the worker's poll and the "live" check after a release).
CREATE OR REPLACE FUNCTION stores_with_bug_reports(p_open_only boolean) RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM bug_report
  WHERE NOT p_open_only
     OR (github_issue_number IS NOT NULL AND status in ('received', 'in_progress', 'fixed'));
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_bug_reports(boolean) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_bug_reports(boolean) TO app;
