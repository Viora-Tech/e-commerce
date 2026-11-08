# Imported themes: small image copies instead of multi-MB originals

On www.waimers.in the home page loaded 9.3 MB of images; one category panel alone was a 4.5 MB
PNG. The causes, all fixed here:

- **Theme import never made sized copies.** `copyImage` / `storeFile` (core theme-import
  `import-media.ts`) stored every copied image as `ready` with no `variants`, so the media
  pipeline never ran on them. They are now stored `processing` and queued like any upload
  (`ThemeImportDeps.processImage`, wired in `importThemeZip` to `enqueueMediaProcess` with
  `bulk: true`). Without a queue the old behaviour stays.
- **Image settings saved as a bare URL (or without copies) never found them.**
  `liquidSettingValue` for `image_picker` now looks the URL up in Files through a new
  batched `LiquidDataCache.image(url)` / `LiquidDataSource.images(urls)` (one query per render
  pass, cached per store version in `liquid-data-cache.ts`), so `image_url: width: 900` picks a
  WebP copy and `image_tag` writes a `srcset`.

- **Review photos** were drawn from the phone's original (0.5–1 MB each): Judge.me's
  `pictures_urls` now carry the 640 copy as `small` and the 1280 copy as `huge`
  (`storeReviewFeed`), and the review widgets use the 1280 copy (`photoCopy` in
  plugin-reviews `reviews.ts`).
- **Product colour swatches** drew the original as a CSS background (1.8 MB for a small
  circle); `swatchFile` in `product-variant-picker.tsx` picks the smallest copy.

**Existing images still need one backfill run** (owner, on the server):
`bun run media:reprocess --store <the Waimers store slug>`. Until it runs, those rows have no copies and the
page keeps the originals.
Rendered sections and the image lookups live at most an hour in the render cache
(`CACHE_TTL_MS`), so the copies show within the hour, or at once after any store edit.
