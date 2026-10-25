# Release lint clean-up (2026-10-26)

`bun run lint` passes again on `dev`:
- `biome.json`: `"recommended": true` → `"preset": "recommended"` (Biome 2.5 deprecation), and `.shopify` (Shopify CLI local state) excluded; `.gitignore` ignores `integrations/shopify/.shopify/`.
- Unused import in `packages/core/src/inbox/panel.test.ts`; formatter fix in `apps/www/src/components/apps/app-sticky-bar.tsx`.
- Theme editor: `customize-editor.tsx` back under the 500-line cap (`sameRef`, `LOAD_TIMEOUT_MS`, `isDesktopHome` moved to `lib/customize-editor.ts`); `apps-panel.tsx` follows the component order and its prop is `installed`.
