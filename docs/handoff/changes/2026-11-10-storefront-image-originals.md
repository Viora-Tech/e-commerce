# Storefront stops sending multi-MB original photos (#1421)

- **Review form thumbnail** (`apps/storefront/src/lib/reviews.ts`): smallest sized copy, lazy, never the original. It was 8–11 MB on product pages with large PNGs.
- **Liquid `default` filter** (`packages/core/src/theme-import/filters.ts`): our own, so an image object passes through whole. LiquidJS's unwrapped it to its URL, and `image_url: width:` then returned the original (home category panels: about 8 MB).
- **Own-size copy** (`variantWidthsFor` in `packages/core/src/media/pipeline.ts`): every image also gets AVIF/WebP at its own width, so small photos and very wide screens never fall back to PNG/JPEG.
- **Backfill:** `bun run media:reprocess --store <slug> --own-size` redoes ready images missing that copy, plus anything never processed. Run once after deploy.
- **Not done here:** the Zero Drift theme's product-image preload names the WebP while the gallery shows AVIF (about 120 KB fetched twice). That's a theme edit, waiting for the owner's OK.
