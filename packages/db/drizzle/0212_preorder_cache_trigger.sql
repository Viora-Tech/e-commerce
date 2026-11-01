-- Pre-order campaigns (0208): the campaign button, badge, price and notes show on product, cart
-- and collection pages, so a write drops the store's cached pages.
DROP TRIGGER IF EXISTS storefront_cache_notify ON "preorder_campaign";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "preorder_campaign"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();
