# Admin redesign: final theme tokens, dropdowns and glass

Branch `feat/proofly-theme-polish`. Shared layer only (tokens and shared components); no page files.

- `packages/ui/src/styles.css`: light and dark values updated to the final Figma variables; new
  tokens (`panel-border`, `input-surface`, `brand-wash`, `brand-wash-end`, `brand-border`,
  `brand-select`, `chip-neutral-text`, `glass-*`, `card-surface`) mapped into Tailwind colour names.
  Utilities added: `surface-card`, `surface-banner`, `glass-bar`, `glass-popover`, `glass-scrim`,
  `motion-menu`. Headings (`text-page-title`, `text-card-title`, kit titles) default to `ink-strong`.
- Card shadow: light two-layer soft lift, dark highlight + black edge + deep spread. Applied through
  `Card` (so table and section cards), `StatTile`, `PageState`, sidebar usage card.
- Dropdowns restyled to the Select docs: select, combobox, dropdown-menu, popover, command. Props and
  behaviour unchanged. `SelectTrigger` default size is now `h-9` and `sm` is `h-8` (was 8 / 7).
- Glass: top bar once the panel scrolls (`TopBar` takes an optional `scrolled`), floating bar,
  menus, popovers, ⌘K, toasts; dialog and sheet scrims. Solid fallback without `backdrop-filter`
  and under `prefers-reduced-transparency`.
- `accent` is now the soft blue (`#EAF1FD` / `#172038`), so menu hover tints blue; `danger` and
  `destructive` are separate tokens again (text red vs solid red).
- Not done: the top bar sits above the scrolling panel, so the blur has little behind it; the glass
  look shows as the bar's translucent edge and shadow. Making content scroll under it would change the shell layout.
