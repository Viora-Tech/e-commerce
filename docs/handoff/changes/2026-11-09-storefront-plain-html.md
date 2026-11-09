# Imported-theme pages as plain HTML, behind a per-store switch (9 Nov 2026)

Design and phases: `docs/design/storefront-plain-html.md`. Branch `feat/storefront-plain-html`.

- **Switch:** Online store › Preferences › Storefront speed › "Send pages as plain HTML"
  (`preferences.delivery.plainHtml`, default off, no migration: preferences are JSON merged with
  `||`). Deployment-wide way back: `STOREFRONT_PLAIN_HTML=off`. One browser: cookie `wc_plain=off`.
- **Scope (phase 1):** `/` and `/pages/<handle>` of an imported Shopify theme. Everything else is
  unchanged. Product, collection, search, blog and article use our React main sections, so they
  stay React until phases 3-4.
- **Flow:** `proxy.ts` asks `lib/plain-html/route.ts` (`wantsPlainHtml`) and rewrites to
  `/-h/<store>/…` (`app/-h/[storeId]/[[...path]]/route.ts`). `lib/plain-html/render.ts` writes
  the theme layout + cached Liquid sections + our SEO head + one inline island
  (`lib/plain-html/islands.ts`: theme boot, consent, analytics tags, Umami, Core Web Vitals). The
  response says `x-storefront-render: plain`.
- **Hand-back:** a page that needs something only React draws (our own section, Inbox chat,
  Chatwoot, Pixels app, app embeds, market banner, an experiment, no theme cookie banner, a 404, a
  policy redirect) is fetched from the React page through this same server
  (`lib/plain-html/forward.ts`) with a signed `x-plain-skip` header that carries the outer nonce.
  The reason is in `x-plain-skip-reason`.
- **Also fixed:** `NONCE_MARK` (`lib/liquid-cache.ts`) is now one per process (on `globalThis`)
  instead of one per module copy. The render cache is shared by every route bundle, so a section
  cached by one bundle kept its placeholder nonce when another bundle served it (scripts blocked by
  CSP). Seen on the new route; it could also hit `theme-actions` section renders.
- **New:** `POST /theme-actions/consent` (the island's consent proof, same action as
  `ConsentManager`); `lib/tracking-snippets.ts` (gtag/GTM/Meta snippets shared with
  `TrackingTags`); `templateSections()` in `lib/template-render.tsx` (the pre-React part of
  `renderTemplate`).
- **Before switching Waimers on:** compare home and a few `/pages/*` side by side; our global CSS
  no longer reaches the theme on plain pages (Zero Drift's heading-reveal CSS lives there).
- **Builds on:** #1359 (banner reveal is inside `renderLiquidSections`, so plain pages get it),
  #1363 (edge purge: plain pages carry the same `cache-control` the proxy picks).
