-- Reviews app (0197): the AI review summary and the answered product questions show on product
-- pages, so a write to either drops the store's cached pages like a review does.
DROP TRIGGER IF EXISTS storefront_cache_notify ON "review_summary";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "review_summary"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "review_question";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "review_question"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();
