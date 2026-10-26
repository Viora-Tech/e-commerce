# Variant images: several per variant, upload from the variant dialog

Branch `feat/variant-images-2026-10-26`, PR into `dev`. Owner report: the variant "Image: Black"
dialog could only pick one existing product photo and had no upload.

## Migration 0174_variant_media

New table `variant_media` (`store_id`, `variant_id` → variant ON DELETE CASCADE, `media_id` →
media ON DELETE CASCADE, `position`; unique `(variant_id, media_id)`), RLS via
`apply_store_rls()`, the `storefront_cache_notify` trigger (listed in
`packages/db/src/storefront-cache.ts`). Backfills one row (position 0) per variant that already
had `variant.media_id`. `variant.media_id` stays and always mirrors the list's first image (null
with none), so cart/order lines, feeds, Meta/Google/Shopify catalogue sync and Liquid
`variant.image` read it unchanged.

## Where the code lives

- `packages/core/src/catalog/variant-media.ts`: the only writer. `loadVariantMedia`,
  `writeVariantMedia` (list + main image in step), `nextVariantMedia` (form list wins; a writer
  that only sends `mediaId`, i.e. imports, puts it first and keeps the merchant's other images;
  none clears), `pruneVariantMedia` (called by `setProductMedia`: images that left the gallery
  leave the variant and the main image moves on), `setVariantMedia` (one variant; files not yet in
  the gallery are appended to it). `deleteMedia` re-points affected variants to their next image.
- Product save: `VariantInput.mediaIds` (ordered, optional) next to `mediaId`;
  `setOptionsAndVariants` writes the list. `products.get` returns `mediaIds` per variant.
- oRPC `products.setVariantImages` ({ variantId, mediaIds }, `products:write`); MCP action docs
  regenerated.
- Admin: `variant-image-picker.tsx` (thumbnail + "+n" count) opens `variant-images-dialog.tsx`
  (centred): ordered chosen list with Main badge, move earlier/later, remove; product photos as
  multi-select toggles; Upload button and drag-and-drop through `useUploadQueue` (same
  presign/confirm pipeline, limits and image processing as the gallery). Uploaded files join the
  product gallery at once and are selected for the variant. Saved with the product form.
  Copy: `data/product-form.ts` `variantImages` (+ Hindi overlay).
- Storefront: `ProductDetail.variants[].imageUrls`; `packages/blocks/src/product-gallery-order.ts`
  puts the picked variant's images first (2+ images; a single image keeps the old "jump to it";
  none leaves the gallery as is).
- Liquid: variant `image`/`featured_image`/`featured_media` now carry the gallery media id (so
  `variant.featured_media.id == media.id` filters work) as separate drops (the `json` filter
  dropped repeated objects); new `variant.media` list. A gallery image with no alt of its own
  that belongs to variants reads its alt as the option value they share (Shopify's
  "alt = colour" grouping convention), else the product title as before.
- Shopify import: Shopify keeps one image per variant (`image { url }` → `imageSrc` →
  `mediaId`); that now lands as the list's first image and keeps any extra images added here.

## Tests

`packages/core/src/catalog/variant-media.test.ts` (assign/reorder/remove, main-image sync,
import mapping, gallery prune, setVariantMedia, media delete, Liquid data),
`packages/blocks/test/product-gallery-order.test.ts`,
`apps/admin/src/components/products/variant-images.test.ts`.

## Not done

Drag-to-reorder inside the dialog (buttons only). Duplicate product still copies no images.
