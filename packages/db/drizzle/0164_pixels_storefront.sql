-- Pixels app, storefront (PR 4). The storefront now reads each store's pixel ids, so a write to
-- pixel_connection drops the store's cached pages like the other rendered tables (0115).
DROP TRIGGER IF EXISTS storefront_cache_notify ON "pixel_connection";--> statement-breakpoint
CREATE TRIGGER storefront_cache_notify AFTER INSERT OR UPDATE OR DELETE ON "pixel_connection"
FOR EACH ROW EXECUTE FUNCTION storefront_cache_notify();--> statement-breakpoint
-- BUMP: the banner's marketing line now names "advertising partners such as Meta" (owner,
-- 2026-10-24), so every store asks its returning shoppers again: banner version + 1. A store that
-- never saved Customer privacy keeps its older banner message (preferences.privacy.message).
UPDATE "store"
SET "preferences" = jsonb_set(
  CASE WHEN jsonb_typeof("preferences") = 'object' THEN "preferences" ELSE '{}'::jsonb END,
  '{customerPrivacy}',
  CASE
    WHEN jsonb_typeof("preferences"->'customerPrivacy') = 'object' THEN
      ("preferences"->'customerPrivacy') || jsonb_build_object(
        'bannerVersion',
        CASE WHEN ("preferences"->'customerPrivacy'->>'bannerVersion') ~ '^[0-9]{1,6}$'
          THEN ("preferences"->'customerPrivacy'->>'bannerVersion')::int + 1 ELSE 2 END
      )
    ELSE jsonb_build_object(
      'bannerMessage',
      left(btrim(CASE WHEN jsonb_typeof("preferences"->'privacy'->'message') = 'string'
        THEN "preferences"->'privacy'->>'message' ELSE '' END), 500),
      'bannerVersion', 2
    )
  END
);
