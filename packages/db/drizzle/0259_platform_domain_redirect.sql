-- The platform subdomain (`<store>.koomerce.app`) sends visitors to the store's custom primary
-- domain (20 Nov 2026): `setPrimaryDomain` turns its `redirect_to_primary` on when a custom
-- domain becomes primary; this does the same for stores whose custom primary was set before.
-- The merchant can still switch it off on the domain's page. Frames (the theme editor canvas,
-- admin thumbnails) and theme-preview links are never redirected (storefront `primaryRedirect`).
UPDATE "store_domain" p SET "redirect_to_primary" = true
WHERE p."kind" = 'platform' AND NOT p."is_primary" AND NOT p."redirect_to_primary"
  AND EXISTS (
    SELECT 1 FROM "store_domain" c
    WHERE c."store_id" = p."store_id" AND c."kind" = 'custom' AND c."is_primary"
      AND c."status" = 'active'
  );
