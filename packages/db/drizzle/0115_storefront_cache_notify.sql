-- Storefront cache invalidation (apps/storefront lib/cache-stamp.ts, packages/db/src/storefront-cache.ts).
-- Every write to a table a storefront page renders sends NOTIFY storefront_cache with the store id;
-- the storefront LISTENs and drops that store's cached sections and data at once. Postgres sends a
-- notification only when the transaction commits, and sends a repeated payload once per transaction,
-- so a bulk import costs one message. Media writes are "soft" (the worker updates rows as images
-- finish): the storefront applies them at most once a minute.
CREATE OR REPLACE FUNCTION storefront_cache_notify() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  sid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    sid := OLD.store_id;
  ELSE
    sid := NEW.store_id;
  END IF;
  PERFORM pg_notify(
    'storefront_cache',
    sid::text || CASE WHEN TG_ARGV[0] = 'soft' THEN ':soft' ELSE '' END
  );
  RETURN NULL;
END $$;--> statement-breakpoint
-- The store row: every setting a page shows lives here, but each order bumps the order counter and
-- the admin's accent colour is admin-only, so an update that changes nothing else stays quiet.
CREATE OR REPLACE FUNCTION storefront_cache_notify_store() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM pg_notify('storefront_cache', OLD.id::text);
    RETURN NULL;
  END IF;
  IF TG_OP = 'UPDATE'
    AND (to_jsonb(NEW) - '{next_order_number,admin_accent}'::text[])
      = (to_jsonb(OLD) - '{next_order_number,admin_accent}'::text[]) THEN
    RETURN NULL;
  END IF;
  PERFORM pg_notify('storefront_cache', NEW.id::text);
  RETURN NULL;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "store";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "store"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify_store();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "article";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "article"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "back_in_stock_settings";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "back_in_stock_settings"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "blog";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "blog"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "business";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "business"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "collection";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "collection"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "collection_product";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "collection_product"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "discount";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "discount"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "gst_registration";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "gst_registration"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "inventory_level";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "inventory_level"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "location";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "location"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "media";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "media"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify('soft');--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "metafield";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "metafield"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "metafield_definition";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "metafield_definition"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "metaobject";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "metaobject"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "metaobject_definition";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "metaobject_definition"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "navigation_menu";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "navigation_menu"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "page";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "page"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "product";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "product"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "product_media";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "product_media"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "product_option";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "product_option"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "product_option_value";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "product_option_value"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "review";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "review"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "review_media";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "review_media"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "shipping_rate";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "shipping_rate"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "shipping_zone";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "shipping_zone"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "store_domain";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "store_domain"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "theme";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "theme"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "theme_file";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "theme_file"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "theme_import";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "theme_import"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "theme_template";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "theme_template"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "theme_version";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "theme_version"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "url_redirect";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "url_redirect"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "variant";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "variant"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
DROP TRIGGER IF EXISTS storefront_cache_notify ON "variant_option_value";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "variant_option_value"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();
