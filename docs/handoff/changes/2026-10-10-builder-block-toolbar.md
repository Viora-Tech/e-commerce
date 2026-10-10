# One floating toolbar per selected block

Branch `feat/builder-block-toolbar`. No migration.

- `section-overlay.tsx` and `canvas-action-bar.tsx` are gone. `block-toolbar.tsx` (Puck's
  `componentOverlay`) draws one bar for the selected block. It holds:
  - the block's name in the accent "selected" chip from the Figma builder frame (369:4809,
    label 369:5160);
  - move up/down, duplicate and delete;
  - B/I/U and link, only while text in that block is being edited.
- `block-toolbar-format.tsx` (Puck's `actionBar`) portals Puck's inline rich-text menu into a slot
  at the end of the bar, so Puck's own bar stays empty. The formatting controls append at the end
  and never shift the other buttons.
- Link control: `inline-format-menu.tsx`, set as `renderInlineMenu` on every richtext field
  (nested ones too) in `customize-config.tsx`, so the storefront never loads it. It validates with
  `normalisePastedUrl` and opens links in the same tab.
- Puck mounts the overlay in the admin document over the canvas, not inside the storefront
  iframe (the old comment and the `--admin-accent` fallback were wrong, so the old chip rendered
  black). The bar now uses admin tokens and follows light/dark. The stale `section-overlay.tsx`
  entry in the hardcoded-colours sweep allow-list is removed.
- Behaviour: the bar sticks to the canvas top while a tall block scrolls under it, and a block at
  the top of the page shows it just inside. Moves keep the moved block selected (`stepActions`).
  The bar is registered with `registerOverlayPortal` and stops its clicks, so a button press no
  longer clears the selection. Fades in 150 ms; immediate under reduced motion.
- Outlines (`vendor-puck.css`): 1px solid accent when selected, 1px dashed when hovered, no fill.
- Rich text lists: lists in the Rich text section and the Text element shrink to their items and
  follow the copy's alignment (the block's align or the section's `text-center`/`text-right`), so
  bullets sit beside centred text (`packages/blocks/src/styles/rich-text.css`).
- Docs: theme-editor.mdx "Block toolbar". Test: `customize-config.test.ts` (inline menu on nested
  richtext fields).
