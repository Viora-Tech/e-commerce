# Imported-theme pages: markup sent once, first sections first (2026-10-12)

Branch `perf/storefront-progressive`. No migration. Full write-up: developer docs
`building/performance` → "Imported themes: weight and streaming".

- **No more double markup.** An imported theme's Liquid HTML used to be in the page twice (the DOM
  and, escaped, the RSC payload). `components/theme/liquid-html.tsx` now parks it in a
  per-process slot (`lib/liquid-slots.ts`) and renders the client component
  `components/theme/liquid-slot.tsx` with only the slot id; the HTML render takes the markup
  back out. In the browser React keeps the server's markup (it never reads `__html` while
  hydrating). Requests with no HTML render (client navigation, prefetch, refresh, server action)
  carry the markup inline: `lib/flight-request.ts` tells them apart by `Next-Action` and
  `Sec-Fetch-Dest`, because Next hides its `RSC` header from `headers()` and from the proxy.
  Each slot carries a nonce-free digest; a later render replaces the markup only when it changed.
- **Progressive streaming** (`lib/liquid-split.ts`, `renderTemplate`): the first
  `STOREFRONT_EAGER_SECTIONS` (default 3) sections render before streaming starts; the rest,
  when their render takes over 25 ms (a cache miss), stream in the same response behind one
  Suspense boundary (`components/theme/deferred-liquid.tsx`); from the cache they are drawn in
  place.
  Crawlers (Next's `userAgent().isBot`) get everything in place. Header/footer groups and theme
  previews are never split. `LiquidBoot` waits until React has put every streamed part in place
  before booting the theme's scripts.
- **Below the fold** (`lib/liquid-fold.ts`, applied before caching, `belowFold` is in the
  section cache key): images and iframes lazy, `fetchpriority="high"` removed, videos
  `preload="none"` with autoplay started near the viewport, and the section's parked scripts
  marked `data-theme-near`; the shim (`lib/liquid-shim.ts`) runs them via IntersectionObserver
  when the section is within a screen of the viewport.
- New optional env key `STOREFRONT_EAGER_SECTIONS` (config schema, `.env.example`, production
  example, compose).
- Known, not fixed here: on a first visit the LCP element is the theme's cookie banner, which its
  own JS shows after boot; the proxy's `rsc` checks (`edge-cache`, `noteVisit`) never see Next's
  `RSC` header (Next strips flight headers before the proxy), so a client navigation's payload is
  marked `public` like the page.
