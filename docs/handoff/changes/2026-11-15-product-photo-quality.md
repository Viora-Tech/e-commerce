# Product photos: sharp files for the lens and the lightbox, honest srcsets in imported themes

Owner's report (15 Nov): "Photo quality is low, all the photos, when I zoom in" on Waimers
(theme Zero Drift: its product page is our React port in `packages/blocks`; its other sections
are imported Liquid).

**What we measured (read-only, live site).**
- The importer did not lose resolution. Matched against the old Shopify pages (Wayback snapshots)
  and Shopify's CDN: 5 of 5 sampled originals at or under 2560 px are stored at exactly their
  Shopify size (4 × 480, 1 × 1335); 3 of 3 larger ones (3000, 3000, 3840 wide) are stored at
  2560, the `MAX_MASTER_LONG_EDGE` cap, by design. The product query asks for `image { url }`
  with no transform, which is the original. No re-fetch command is needed.
- The small photos are small on Shopify too. Census of all 252 product pages, 2147 images:
  11% are 480 px or less, 13% 481–799, 5% 800–999, 13% 1000–1279, 14% 1280–1919, 11%
  1920–2559, 34% 2560. 167 files carry Shopify's old `_large` suffix: they were uploaded to
  Shopify as Shopify's own 480 px copies. 53 of 252 products have a main photo of 480 px or
  less; 106 of 252 under 1000 px. Only new uploads can fix those.
- What we did wrong: the hover lens (2.4×) magnified the file picked for the unzoomed stage, and
  the lightbox asked for `100vw`. On a 1440 px 2× screen the lens showed a 1920 file at 3456 px
  (1.8× stretched) although a 2560 copy exists; on a 1920 px 1× screen a 1280 file at 2304 px.
  On a 3× phone the lightbox picked the 1280 copy, soft once pinched.
- Imported Liquid sections wrote srcsets by hand (`image_url: width: 600 }} 600w, …`), so one
  480 px copy went out as `600w, 900w, 1200w`, and 640/1280 copies as `400w`/`800w`.

**Fix.**
- `blocks/effects/lens.tsx`: a `zoomed` prop, the copy the lens magnifies (`LENS_ZOOM_FACTOR`
  exported). `product-gallery.tsx` passes a second `<Picture>` with `sizes` 120vw (50vw × 2.4),
  stacked over the stage's own file so the lens never shows an empty circle while it loads. It
  mounts on the first hover only.
- `product-gallery-lightbox.tsx`: `sizes` is `(min-width: 990px) 100vw, 200vw`; phones get the
  largest copy for pinching.
- `core/theme-import/srcset.ts` (new): `honestSrcsets` rewrites every `srcset` / `imagesrcset` /
  `data-srcset` in a Liquid render so our sized copies (`…/media/…-w<n>.webp|avif`) carry their
  real width, once, smallest first; lists with `x` descriptors or none of our copies are left
  alone. Run once per outermost `renderBounded`.
- `img_url` / `product_img_url` / … (legacy size strings `600x`, `x600`, `600x400`, `large`,
  `scale: 2`) now give the sized copy, as `image_url: width:` does (`legacyImageUrl`); before,
  every size gave the full original.
- `core/media/loader.ts`: `nearestVariantWidth` / `pickVariantUrls` round up (smallest copy at
  least the wanted width, else the largest) instead of down; unused `generatedWidths()` removed
  (it ignored own-size copies). No app imports these today.

**Before / after (main photo, from the live variant lists).**
- X2N Crazylight (2560 px): 1440@2× lens 1920 file stretched 1.8× → 2560 file (1.35×, the cap);
  phone lightbox 1280 → 2560.
- Talongames Hoshi (1500 px): phone lightbox 1280 → 1500; lens stays the 1500 file (source limit).
- Meiy glass pads (1st and 2nd gen, 480 px): no change possible, 480 is the whole photo.

**Left for the owner.** Re-upload larger photos for the products whose photos are Shopify
`_large` copies or supplier thumbnails (list: the 53 products with a main photo ≤ 480 px; ask
for it). The 2560 cap means even the best photos are 1.35× stretched under the lens on 2×
screens; raising it costs storage and worker memory (owner decision).
