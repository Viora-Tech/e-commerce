# Imported Shopify sections in the Add panel (2026-10-11)

Admin only, no migration. When Customize edits an imported Shopify theme, the Add panel's Sections view gets a folding group **Imported from Shopify** above the library, with that theme's own sections as tiles carrying a small "Shopify" badge. The search filters both. Our own themes, and header/footer group popovers, never show it.

- Which sections: those whose `{% schema %}` has a preset (Shopify's own rule for "addable"). Header, footer and the main product section are placed by the theme.
- Adding: a `LiquidSection` built from the first preset (`lib/imported-sections.ts`: schema defaults, then preset settings and blocks, both preset forms). Inserted with a fresh id like "My sections".
- Data comes from `themes.import.editor` (already per store and theme via `theme_file` + RLS), handed to the panel through `ImportedThemeContext`.
- Tiles are click-to-add, not draggable (Puck drags a component type; an imported section needs its preset settings). No hover preview.
- Not checked in a real browser (the Chrome extension was not connected); covered by jsdom tests.
- Not built: respecting a schema `limit` (one-only sections), dragging imported tiles, live previews.
- Copy: `themeImportContent.addPanel` + Hindi overlay.
