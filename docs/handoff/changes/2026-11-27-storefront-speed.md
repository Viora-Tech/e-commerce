# Storefront speed fixes from the 27 Nov Lighthouse run

Branch `perf/storefront-nov27` (from `origin/dev`). No migration. Owner approved the list on
27 Nov; not released.

## What changed

- **Chat button stops forcing layouts** (biggest TBT: about 3 s of style and layout on Waimers'
  home page on a phone was blamed on `/api/islands/chat.js`). New
  `apps/storefront/src/lib/launcher-watch.ts` (`watchLauncher`) decides when the button looks at
  the page: tuck on scroll (one animation frame per frame, passive), lift once the scroll settles,
  on resize and load, on `<html>`/`<body>` class or style, `<body>` children, `open` anywhere,
  class or `hidden` on `.sticky-atc` / `[data-chat-tuck]`, and 0.35 s after a tap or key. Always
  in an animation frame, never inside an observer; no more whole-body class observer or
  document `transitionend`. Used by `components/inbox/inbox-launcher.tsx`; the plain page's
  `lib/plain-html/chat-module.ts` does the same in plain JS with the numbers from
  `chatModuleSpec` (`watch`, `settle`, `scrollSettle`, `late`).
- **Fonts on the plain page** (`lib/plain-html/theme-fonts.ts`, `render.ts`): families the
  theme's own Google Fonts links already ask for are not asked for again, so Waimers' second
  link is Plus Jakarta Sans only (the theme's `:root` names it but never loads it). A preconnect
  to `fonts.gstatic.com` (crossorigin) comes before the font stylesheets. Noto Sans JP is the
  theme's own link (`layout/theme.liquid`, print-then-all) and the store has Japanese product
  names (稲荷, 暁獅, 鬼の誓い...), so it stays.
- **Theme CSS** (`lib/theme-css.ts`): `bundleThemeStylesheets` turns each run of the theme's
  plain stylesheet links with no other CSS between them into one
  `/theme-assets/<theme>/~bundle.css?f=a.css,b.css&v=<hash>` link at the run's first link
  (order kept, repeats kept, links with other media or attributes left alone and treated as a
  break). Applied to the layout head (every page, before the render cache) in `liquid-theme.ts`
  and to the whole plain page in `plain-html/render.ts`. Waimers home: 35 links to 4. The
  theme-assets route (`app/-s/[storeId]/theme-assets/[themeId]/[file]/route.ts`) answers the
  bundle (a year when the hash matches the files' checksums, 5 minutes otherwise) and serves all
  theme CSS minified (`minifyCss`: comments and whitespace only), kept in memory by checksum.
- **Images**: on product pages a theme image preload of our WebP variants becomes the AVIF twins
  with `type="image/avif"` (`lib/liquid-preload.ts`, called in `liquidLayoutFor`), so phones no
  longer download the main image as WebP and again as AVIF. Our product card
  (`packages/blocks/src/components/product-card.tsx`) gets `CARD_SIZES`: the phone clause is the
  card's width (`calc(50vw - 1.375rem)`), and the hover image, which had no `sizes` (100vw),
  gets the same.
- **Videos** (worker): the poster frame comes from 1 s in, the most typical of 12 frames
  (`posterFrameArgs`, ffmpeg `thumbnail`), frame 0 only for a shorter clip. A portrait video gets
  the phone copy (`PORTRAIT_COPY` in `packages/core/src/media/compact-video.ts`: 720 wide, CRF 28,
  about 1 Mbps; `copyShapeFor`). A silent sound track (`volumedetect` at or under -60 dB) is left
  out (`silentAudio`). Landscape copies keep #1783's settings.

## Not done, and why

- **Theme JS minify**: no JS minifier is a runtime dependency of the storefront (esbuild is only
  a transitive dev dependency, lightningcss is CSS only and a root dev dependency). Adding one is
  a new dependency for the owner to decide; Lighthouse put the saving at about 30 KiB per page
  before compression.
- **React chunks**: `0rofg603kmm1h.js` (67 KiB, 60 unused) holds the client parts of every Zero
  Drift section (hero carousel, sign-up popup, newsletter, social wall, store locator, size
  guide...), pulled into the store layout through the `@commerce/blocks` section registry that
  `app/-s/[storeId]/layout.tsx` imports; an imported Liquid theme draws none of them.
  `376toei0g2-nn.js` is react-dom's client runtime. Lazy-loading the registry's client sections
  is a structural change to `packages/blocks` that needs a production build and
  `bun scripts/perf/first-load-js.ts apps/storefront` to check, so it is left for a session that
  may build.
- **Theme files**: the card snippet's `sizes` (`(min-width: 990px) 25vw, (min-width: 750px)
  33vw, 50vw`) and its hover image (loads on phones, never shown) are the theme's; the same
  `calc(50vw - 1.375rem)` phone clause applies there.

## Tests

- New: `apps/storefront/src/lib/launcher-watch.test.ts` (jsdom), `theme-css.test.ts`,
  `liquid-preload.test.ts`; changed: `plain-html/theme-fonts.test.ts`,
  `packages/core/src/media/compact-video.test.ts`, `apps/worker/src/video-ffmpeg.test.ts`,
  `video-compact.test.ts`.
- `minifyCss` was checked on all 40 Waimers theme CSS files from the live site: each parses to
  the same rules as the original with lightningcss (654 KB to 305 KB before compression).

## Left to do / for the owner to check

- On localhost, Waimers home on a phone width: the chat button still tucks on scroll down,
  comes back on scroll up, hides while the sticky add to cart shows, sits above the bottom dock
  and hides under the open cart drawer.
- Pages look the same with the bundled CSS (home, product, collection, cart, cart drawer).
- Existing videos keep their copy and poster: `bun run media:videos --store waimers --force`
  remakes the copies. Posters are only made for videos with none and the poster object in the
  bucket is reused, so the black Waimers hero poster stays until a new poster is chosen in the
  theme editor's media field (or the old poster object is deleted and the link cleared).
- The bundle on a theme with one stylesheet that starts with `@import`: the import moves to the
  bundle's top (CSS only allows it there); no Waimers file has one.
