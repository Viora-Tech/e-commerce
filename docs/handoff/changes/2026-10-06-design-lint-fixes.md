# Design lint fixes (2026-10-06)

`bun run lint:design`: 1,525 warnings to 124, no visual change (every replacement renders the same classes).

- `.oxlintrc.json`: allow list for marker classes, contracts for table cells, triggers, card regions and form controls; per-file off for dynamic inline styles and constant-built class strings.
- `packages/ui`: `Card` gets `gap` and `inset` props, `AlertDialogAction` gets `tone="destructive"`; both add the same classes the pages used to pass.
- `apps/admin`: about 70 files switched to those props; 7 inline styles moved to CSS custom properties.
- Left for the redesign (see `docs/design/design-lint.md`): 115 `no-restyle`, 8 `no-raw-colors`, 1 `no-unknown-classes`.
