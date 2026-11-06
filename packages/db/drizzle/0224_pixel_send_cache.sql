-- Sending an event writes last_sent_at and last_error on pixel_connection. Those are bookkeeping no
-- page shows, and on a hard trigger each send dropped the store's whole page cache. Only the
-- columns below notify now.
DROP TRIGGER IF EXISTS storefront_cache_notify ON "pixel_connection";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify
AFTER INSERT OR DELETE OR UPDATE OF "platform", "pixel_id", "name", "token_enc", "token_hint", "test_event_code", "events", "purchase_trigger", "status"
ON "pixel_connection"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();
