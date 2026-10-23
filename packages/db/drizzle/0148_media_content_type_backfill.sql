-- Media stored without a type (the dev seed and older imports kept Shopify CDN URLs and set
-- none) get the type their key, else URL, extension implies, ignoring any `?query`. Same map
-- as `contentTypeFromName` in packages/core/src/media/content-type.ts. Data only; rows with
-- no known extension stay NULL (Files counts them as documents).
UPDATE "media"
SET "content_type" = CASE lower(substring(split_part(coalesce("key", "url"), '?', 1) from '[.]([A-Za-z0-9]+)$'))
  WHEN 'jpg' THEN 'image/jpeg'
  WHEN 'jpeg' THEN 'image/jpeg'
  WHEN 'png' THEN 'image/png'
  WHEN 'webp' THEN 'image/webp'
  WHEN 'avif' THEN 'image/avif'
  WHEN 'gif' THEN 'image/gif'
  WHEN 'svg' THEN 'image/svg+xml'
  WHEN 'mp4' THEN 'video/mp4'
  WHEN 'webm' THEN 'video/webm'
  WHEN 'mov' THEN 'video/quicktime'
  WHEN 'pdf' THEN 'application/pdf'
END
WHERE "content_type" IS NULL
  AND lower(substring(split_part(coalesce("key", "url"), '?', 1) from '[.]([A-Za-z0-9]+)$'))
    IN ('jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg', 'mp4', 'webm', 'mov', 'pdf');
