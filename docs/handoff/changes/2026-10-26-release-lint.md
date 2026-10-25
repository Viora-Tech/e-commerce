# Release lint clean-up (2026-10-26)

`bun run lint` passes again on `dev`:
- `biome.json`: `"recommended": true` → `"preset": "recommended"` (Biome 2.5 deprecation), and `.shopify` (Shopify CLI local state) excluded; `.gitignore` ignores `integrations/shopify/.shopify/`.
- Unused import in `packages/core/src/inbox/panel.test.ts`; formatter fix in `apps/www/src/components/apps/app-sticky-bar.tsx`.
- Theme editor: `customize-editor.tsx` back under the 500-line cap (`sameRef`, `LOAD_TIMEOUT_MS`, `isDesktopHome` moved to `lib/customize-editor.ts`); `apps-panel.tsx` follows the component order and its prop is `installed`.

Also in this PR:
- Tests: `affiliate_program` added to `STOREFRONT_CACHE_EXEMPT` (the affiliate signup page is per shopper, never cached); the globe palette test expects the border swatch added with the border colour picker.
- Agentic sales › Catalog readiness (score column) and › Controls (summary column) keep their side column in view (`lg:sticky lg:top-4`).
- Social channel page: "Items live — variants of your N active products" and "N of M items sent" (a feed item is a variant, so 990 items vs 242 products read as wrong).
