# Imported themes: nested theme blocks (product tabs no longer crash)

**Bug:** Zero Drift's `product-tabs` section crashed with a Liquid stack overflow. Each
`_tab` theme block runs `{% content_for 'blocks' %}` to draw its contents, but:
- the importer kept only top-level blocks and dropped each tab's children;
- the engine's `content_for 'blocks'` always listed the section's blocks.

So inside a tab, it drew the tabs again, then again inside those, forever.

**Fix**
- `import.ts` `templateBlocks()`: keeps nested `blocks` / `block_order`, up to `MAX_BLOCK_DEPTH` (8, Shopify's limit).
- `fields.ts`: `LiquidBlockItem.blocks` (optional), read back recursively by `blocksFromProps`.
- `render.ts`: `sectionBlocks` maps nested blocks. `renderThemeBlock` gives the block's render a scope with
  `BLOCK_SCOPE.parent` (the block itself) and `BLOCK_SCOPE.depth`.
- `engine.ts` `ContentForTag`: inside a theme block, `content_for 'blocks'` / `'block'` read that block's
  own children, never the section's. Past depth 8 it renders nothing, which stops a block that places itself.

**Notes**
- Themes imported before this have no nested blocks stored. Their tabs now render empty instead of
  crashing (Zero Drift's `_tab` hides an empty tab). Re-import the theme to get the tab contents.
- Nested blocks are kept and rendered, but Customize doesn't show them as editable fields yet.
  Editing the tab's own settings in Customize may drop its children. Follow-up when the builder work
  reaches nested blocks.

Tests: `engine.test.ts`, covering the tabs with their own children, the self-placing block stopping at depth 8,
and `blocksFromProps` with nested blocks.
