# Picture offers the original when it is wider than every variant (#1271)

The media pipeline never upscales, so a 480 px original gets only a 320 variant. `<Picture>`
built its `srcSet` from variants alone, so the browser could only pick 320 and the Waimers glass
mousepad's first image looked blurry at about 1000 CSS px.

- `packages/blocks/src/components/picture.tsx`: when `image.width` (the original's pixel width)
  is above the widest variant, the original URL is added to both `<source>` srcsets as its own
  width candidate, and becomes the `<img>` fallback. Nothing is upscaled.
- `MediaImage.width` (blocks types) is new and optional; the product page gallery
  (`apps/storefront/src/lib/catalog.ts`, core `productGallery`) and product cards (catalog and
  collections) now select `media.width`. Other `<Picture>` callers without a width behave as
  before.
- `packages/core/src/media/loader.ts` is unchanged: `@commerce/blocks` cannot import core (core
  depends on blocks), and its single-URL `next/image` loader is not used by the gallery.
- Test: `packages/blocks/test/picture.test.tsx`.
