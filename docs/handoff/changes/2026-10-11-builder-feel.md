# Website builder: faster canvas, clickable sections, true full view, rail icons (2026-10-11)

Branch `fix/builder-feel`. No migrations, no API changes. Admin only (`apps/admin`), plus docs.

- **Idle CPU**: off-screen sections stop animating (`installOffscreenPause`,
  `OFFSCREEN_PAUSE_CSS` in `lib/customize-canvas-motion.ts`); the drag FLIP loop only runs while
  `data-puck-dragging` is on. Idle main-thread time on a 24-section page went from ~1.6 s per 5 s
  to ~10 ms (Chrome trace; the cost was `Layerize` every frame).
- **Typing / selecting**: Layers rows subscribe to their own section (`section-tree-entry.tsx`,
  `rowsKey` in `section-group.tsx`); the block toolbar's store subscription moved to
  `block-toolbar-bar.tsx` (mounted for hovered/selected only); the insert line reads the store on
  pointer move, once a frame; the audit count is deferred; drafts skip the whole-page diff once
  dirty.
- **Canvas pointer rules** (`lib/customize-canvas-interaction.ts`): arrow cursor, controls in the
  selected section clickable, a section moves only from the toolbar grip (`forwardSectionDrag`),
  links/forms never navigate the canvas. Liquid sections still have no scripts on the canvas.
- **Full view**: no top bar, no gutter, page at window width on Desktop, Puck interactive mode
  (Preview) with a Preview/Edit toggle in the pill. `vendor-puck.css` undoes the storefront's
  `scrollbar-gutter: stable` for the admin document (the 15px stripe on the right).
- **Icons**: rail = admin sidebar standard (duotone 18px, filled accent when open); imported
  sections get glyphs from their file name (`sectionHandle`, `IMPORTED_GLYPHS`); Blocks tiles
  without a picture show their glyph.
- Docs: developer "Theme editor" (Canvas pointer rules, Canvas performance, Full view, icons);
  merchant "Website builder" (grip, full view).
- Left: the first open of the Add panel is still a ~200 ms task in dev (75 cards mount); numbers
  were measured on the dev server (no production build: RAM), so absolute ms are pessimistic.
