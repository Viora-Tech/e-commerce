# Imported theme animations (#280)

Branch `fix/imported-theme-animations`. Checked on a duplicate of the Zero Drift import in my
own DB copy, page by page against the live Shopify site (waimers.in), measuring which elements
animate in each section, hydration errors, CSP violations and undefined custom elements.

What did not run, and why:

| Where | What | Cause | Fix |
| --- | --- | --- | --- |
| Product page (any page where our swapped-in React section shares theme class names) | Newsletter meteors, scroll reveals, rotating words, cart drawer reveals; every section's bound behaviour | Theme `defer` scripts (aceternity-extras.js lens zoom) edited `.product-gallery__main` before React hydrated → hydration mismatch → React rebuilt the page client-side → Liquid sections re-inserted via innerHTML, scripts dead | Deferred/module scripts parked and run after hydration (`liquid-defer.ts`, shim `__commerceBootTheme`, `liquid-boot.tsx`) |
| Any page with `cjk_fallback` | Noto Sans JP sheet never applied | `onload="this.media='all'"` blocked by CSP (`script-src-attr`) | Shim promotes those sheets |
| Home: Reviews showcase | Renders nothing | Data: the Reviews app has no reviews (Judge.me's reviews were not imported) | Not a shim; import or collect reviews |
| Home: Drop reveal | Renders nothing | Data: its collection setting is `preorder`, which this store does not have | Create/import the collection |
| Product, collection, page templates | Theme's specs, size guide, tabs, related, sticky ATC never render | Import coverage: only home, header and footer templates were converted | Separate import work |
| Customize canvas | No theme animation | By design: imported sections render there with scripts removed | — |

Matching live: hero carousel autoplay and Ken Burns, announcement marquee, logo carousel, social
wall, Discord aurora, Perfect match orbit, drops teaser beam, newsletter meteors (home),
countdown, cookie banner. No missing Shopify globals at runtime; `shopify:section:*` events are
only fired by Shopify's own editor; IntersectionObserver reveals start once the scripts run.

- Tests: `apps/storefront/src/lib/liquid-defer.test.ts` (ran once, passes).
- Docs: developer docs Shopify theme import → "Theme scripts wait for React".
