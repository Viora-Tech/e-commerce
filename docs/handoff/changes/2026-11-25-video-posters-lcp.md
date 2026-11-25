# First-frame video posters for the hero LCP

Owner-approved for the 25 Nov 2026 release. Live www.waimers.in had a field LCP of 5.1 s: the LCP
element was hero slide 1, `<video class="hero-carousel__video" preload="none" autoplay>` with
no poster, so LCP waited for the video (4.7 MB phone source, 9.3 MB desktop). Shopify renders
`poster="…preview_images/<id>.thumbnail.0000000000.jpg"` on the same theme and its LCP fires on
that picture. Koomerce now does the same. No migration.

- **Worker** (`apps/worker/src/video-compact.ts`, new `video-poster.ts`, `video-ffmpeg.ts`
  `posterFrameArgs`/`firstFrameFile`): the job that makes a video's `.small.mp4` also grabs its
  first frame (ffmpeg, PNG), and sharp makes a WebP beside the video at
  `<key without extension>.poster.webp` (`videoPosterKey` in
  `packages/core/src/media/compact-video.ts`). Width 1280 for a landscape video, 750 for a
  portrait (phone) one, never upscaled; WebP quality 62, then 48, then 36 until it is under
  60 KB (test clips: 1280×720 47 KB, 750×1333 50 KB). The poster is saved as a picture row in
  Files and linked as the video's `poster_media_id` only while that is null (`linkAutoPoster`),
  so a poster the merchant picked or the admin grabbed on upload always wins and is never
  replaced. Idempotent: a video with a poster is skipped; a poster object already in the bucket
  is linked, not remade; a re-run reuses the picture row at that address. A failed frame grab is
  logged and never fails the copy. A small video (under 4 MB) is now downloaded for its poster
  alone (still no encode).
- **Storefront** (new `apps/storefront/src/lib/liquid-video-poster.ts`, wired in
  `liquid-theme.ts` next to the small-copy swap): for each rendered Liquid section with videos,
  the videos' posters are read from Files (`postersByVideoUrl`) and keyed by both the original
  and the small copy's address. A `<video>` that already has a `poster` keeps it.
  - The page's first video (first above-the-fold template section with a video) gets a real
    `poster` plus `<link rel="preload" as="image" fetchpriority="high">` placed just before it.
    With a phone `<source media="(max-width: 749px)">` and a desktop source that have different
    posters, both are preloaded under their media query (`media="(max-width: 749px)"` and
    `media="not all and (max-width: 749px)"`), and a 300-byte inline script (with the CSP nonce)
    right after `</video>` sets the matching one as `poster` while the page parses. A
    `poster` attribute cannot switch by media query, and writing the desktop one would make
    phones fetch it too.
  - Later videos (slides 2 and 3, promo tiles) stay lazy: a theme `data-poster` is left as it
    is; a video with none gets the auto poster as `data-poster`.
  - Added posters carry `data-auto-poster`, so `withoutVideoCovers` (owner rule of 17 Nov:
    the theme's own cover picture is not shown to shoppers) never moves them, and the cover
    fallback script (`liquid-video-fallback.ts`) still swaps in the theme cover when a video
    cannot play.
  - Built-in (Puck) sections already filled an empty poster from `poster_media_id`
    (`attachImageMedia`); they now get the auto posters too, with no code change.
- **Backfill** (`apps/worker/src/media-videos.ts`): `bun run media:videos` now also picks
  videos with no poster, makes just the poster for a video whose copy was already looked at
  (result `poster`), and prints `N posters only` at the end. The hourly sweep is unchanged: it
  finds stores through `stores_with_videos_needing_copy()` (copy-only), and changing that would
  need a migration. New uploads get their poster from their normal upload job.

## Backfill the live store after deploy

1. Deploy the worker and storefront images from this release.
2. In the worker container (Dokploy, worker service, Terminal; working folder
   `/repo/apps/worker`, which has the production env), run:
   `bun run src/media-videos.ts --store <waimers store slug>`
   It needs `DATABASE_URL_OWNER` in the worker's env (as for `media:reprocess`). One video at a
   time; each poster is a download plus a frame grab (a few seconds). Safe to stop and re-run.
   Every line prints `<media id> poster` (or `skipped` for a video that already has a poster).
3. The `media` table's cache trigger refreshes cached pages when a poster is linked. Check the
   home page source: slide 1's `<video>` is preceded by two `rel="preload" as="image"` links to
   `…hero….poster.webp`, then re-run PageSpeed Insights (mobile) for the LCP element.

Not done: the poster is always the first frame, as Shopify's is; a video that opens on black
gets a black poster (and Chrome does not count a near-blank picture as LCP). If a Waimers hero
video opens on black, pick its poster in Files (the merchant's poster wins).
