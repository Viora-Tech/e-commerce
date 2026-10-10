# Editor: scrolling, one place for theme settings, panel collapse and full view

Branch `fix/editor-panels-fullview`. Checked in headless Chrome on a duplicated theme (my DB copy).

- Scrolling: the Add panel's list could not scroll (Puck's `Drawer` had no height, so the inner
  `overflow-y-auto` never got one); the scroller now wraps the Drawer. Verified every left tab and
  the inspector with wheel events at 1920×1080 and 1366×700.
- Theme settings only in the rail's Theme tab; the right panel with nothing selected shows
  `inspector-empty.tsx` (Figma 369:129005: "Page", "Select a section to edit it.") plus tips.
- Panel collapse: edge tabs on the canvas (`panel-toggle.tsx`), remembered per browser
  (`lib/customize-view.ts`). Full view: top bar button, `\` or Ctrl/⌘ + `.`, Esc and an
  "Exit full view" pill (`full-view-button.tsx`, `full-view-exit.tsx`).
- Root cause of upper-cased chrome headings and 16px inputs: the storefront block CSS's element
  rules; reset for the chrome in `vendor-puck.css` (`data-editor-chrome`, portalled content).
- Tests (written): `lib/customize-view.test.ts`; `section-inspector.test.tsx` updated.
