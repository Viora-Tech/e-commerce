# Section rendering in the editor preview

**Report:** the Waimers home "Ships today strip" shows "45 products in stock" on www.waimers.in but
an empty box (icon only) in Customize.

**What was found (watched in Chrome, 23 Nov):**

- Customize's default canvas is Puck's `srcdoc` iframe on the admin origin. Imported sections are
  server-rendered with their scripts removed (theme code never runs on the admin origin, see the
  theme editor guide), so `ships-today.js` never runs there and the count stays empty. That is by
  design, not a fetch failure: no request is made.
- The **Theme scripts** pill frames the store page itself
  (`https://www.waimers.in/?theme-preview=…&theme-design-mode=1`). There the script runs and the
  strip shows the count (44 in stock at the time).
- The real bug sat under that frame: a frame never holds the preview cookie (the proxy sets it on
  top-level visits only, and it is `SameSite=Lax`, so a cross-site frame would not send it anyway),
  and the shim's fetch wrapper sent `/theme-actions/section?…` without the token. Every section,
  predictive search and recommendations fetch from a previewed frame therefore rendered the
  **live** theme. Waimers edits its live theme, so it looked fine; on a draft (unpublished) theme or
  a Versions › Preview the section came from the wrong theme, or 404 (empty) when only the draft
  has it.

**Fix:** the layout hands the shim the verified preview (`shimPreview` reads the proxy's derived
`x-theme-preview` / `x-theme-version` headers), and the shim adds `?theme-preview=` (and
`?theme-version=`) to the calls that render theme code: section rendering, `/search/suggest`,
`/recommendations/products`. The proxy already accepts the param on any request and sets the
cookie only for a top-level document, so nothing else changed. The live store's pages carry no
token (`preview` is absent). Files: `apps/storefront/src/lib/liquid-shim.ts`,
`apps/storefront/src/app/-s/[storeId]/layout.tsx` (one line).

**Not changed:** the default canvas still runs no theme scripts, so any JS-filled content (this
count, lazy tabs) shows only in the Theme scripts view. Making Theme scripts the default view for
imported themes on the home and product templates is an owner decision.

**Check:** `cd apps/storefront && bunx vitest run src/lib/liquid-shim.test.ts
src/lib/section-rendering-proxy.test.ts`. On a store: open Customize on an unpublished imported
theme, switch on Theme scripts, and a section the theme fetches (`?section_id=`) fills in from that
theme.
