# Admin UI polish (2026-10-11)

- **Fonts match Proofly.** `apps/admin/src/app/layout.tsx` loads DM Sans and Bricolage Grotesque as
  full variable fonts (no static weight list) and adds Geist Mono (`--font-mono-code`); the
  system-mono override in `globals.css` is gone. Type tokens in `packages/ui/src/styles.css`:
  caption and table head 12px to 13px, eyebrow 11px to 12px, dark `--muted-foreground` is Proofly's
  `#9aa0ab`.
- **Shopify importer.** Imports tab: one empty state when not connected and nothing was ever
  counted; one primary ("Preview everything" until every count is checked, then "Import
  remaining", "Everything is here" only when all counts were checked and match); per-row actions in
  a menu; the images row shows the same placeholder as the others. No duplicate tab titles. CSV tab:
  three choice cards, drag-and-drop zone, hint under the disabled button, "How to export" help in
  the right column. Connect tab: no duplicate "(recommended)", scopes as code chips with "Copy all
  scopes", numbered stepper with external links, steps left and form right (sticky).
- **Sidebar motion.** 220ms strong ease-out on the rail width; labels fade (out first, in a beat
  after) and never wrap; icons keep their position (no justify switch); Cmd/Ctrl+B snaps (root gets
  `data-sidebar-instant` briefly, `SidebarShortcutGuard`); reduced motion is instant. Classes live
  in `lib/sidebar-motion.ts`. The shared sidebar in `packages/ui` is untouched: the timing is set
  from `admin-frame.tsx`.
- **Theme switch.** `components/layout/theme-toggle.tsx`: `role="switch"` pill, sun/moon thumb, 180ms.
  "System" stays in Account, Appearance.
