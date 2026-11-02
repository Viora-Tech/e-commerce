-- Reserve a draft's items until a date (#1030): what it holds, where, and until when.
ALTER TABLE "order" ADD COLUMN "draft_reserved" jsonb;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "reserved_until" timestamp with time zone;--> statement-breakpoint
CREATE OR REPLACE FUNCTION stores_with_expired_draft_holds() RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT store_id FROM "order"
  WHERE status = 'draft'
    AND reserved_until IS NOT NULL
    AND reserved_until < now();
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION stores_with_expired_draft_holds() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION stores_with_expired_draft_holds() TO app;
