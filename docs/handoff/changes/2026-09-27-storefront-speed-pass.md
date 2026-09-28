# Storefront speed pass

**Storefront speed pass** (27 September 2026, `perf/storefront-speed`, no migration, no
visual changes): first-load JS on every store route **~306 kB → ~167 kB gzip** (132 kB is
React + Next). zod left the browser (zod-free subpaths `@commerce/core/consent`,
`/theme-preview`, `/adjustment-math`, `/gift-card-code`, `/account-patterns`,
`/return-reasons`, `@commerce/plugin-emi/offer-for`; the preview bridge `import()`s the theme
schema only inside a verified admin frame). Motion is fetched on demand
(`packages/blocks/src/lazy-motion.ts`; blocks never import `motion`/`motion/react` statically;
`use-reduced-motion.ts` replaces Motion's hook). SectionFrame skips the client reveal wrapper
when a section has no entrance animation; entrance animations no longer SSR `opacity: 0`.
Section images get AVIF/WebP + ThumbHash via `<Picture>` (render-time lookup,
`apps/storefront/src/lib/media-lookup.ts`); the first page section gets `_aboveFold` (eager +
`fetchpriority=high` in image banner and split hero); the product gallery uses `<Picture>`;
the header logo gets a real `height`. Figtree italic no longer preloaded. GA4/GTM/Meta pixel
`lazyOnload`; Razorpay affordability script after load + idle. SEO files no longer set the
visitor cookie (they are `public`-cached). Measure with `bun scripts/perf/first-load-js.ts
apps/storefront` after `next build`. Developer docs: Building → "Storefront performance".
Open follow-ups: `Cache-Control` on R2/S3 media objects (none today), an index on
`media.url` (the render-time lookup scans the store's media rows), Lighthouse numbers on
real data (needs Postgres, not measured in the PR).
