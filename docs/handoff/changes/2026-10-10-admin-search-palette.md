# Admin search palette (⌘K) redesign

Branch `feat/admin-search-palette`. No migration.

- `components/layout/command-palette.tsx` is now only the glass dialog shell; contents live in
  `palette-body.tsx` (mounted only while open, so each open starts empty) with `palette-results`,
  `palette-row`, `palette-state`, `palette-scope-chips`, `palette-footer`, `palette-highlight`.
- Logic: `lib/palette-search.ts` (scopes, highlight, recents, links), `lib/palette-rows.ts`
  (sections and rows), hooks `use-palette-search` (150 ms debounce, stale answers dropped, per-group
  permissions), `use-palette-sections`, `use-palette-recents` (localStorage per member, max 6),
  `use-assistant-enabled` (hides Ask AI when AI is off).
- Copy: `paletteContent` in `data/command-palette.ts`, Hindi in `data/hi/command-palette.ts`.
  Quick actions (`QUICK_ACTIONS`) and pages carry the permission the member needs.
- API: `orders.list` search now also matches an order number (`#1042` or `1042`); the old client-side
  workaround (fetch 100, filter) is gone. Test in `packages/api/test/orders-status-split.test.ts`.
- Not done: "Add customer" quick action (there is no create-customer screen).
