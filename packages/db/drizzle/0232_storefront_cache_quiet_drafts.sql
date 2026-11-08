-- Customize and Edit code save drafts as the merchant works: Customize writes theme_template.draft
-- 600 ms after each change, Edit code writes theme_file.draft_body on each save. No shopper sees a
-- draft (a theme preview reads it live and is never cached), yet on a trigger for every column each
-- of those saves dropped the store's whole page cache and re-rendered its recent pages, so pages
-- stayed uncached while anyone edited a theme. Only the columns below notify now; Publish copies
-- the draft into sections / body, which still notifies.
DROP TRIGGER IF EXISTS storefront_cache_notify ON "theme_template";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify
AFTER INSERT OR DELETE OR UPDATE OF "id", "store_id", "theme_id", "template", "suffix", "sections"
ON "theme_template"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "theme_file";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify
AFTER INSERT OR DELETE OR UPDATE OF "id", "store_id", "theme_id", "path", "body", "encoding", "content_type", "size", "checksum"
ON "theme_file"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();
