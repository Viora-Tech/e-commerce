# Imported (Shopify) sections: blocks in Layers, one block at a time in the inspector

Owner and tester: an imported section's blocks (Hero carousel slides …) were only cards in the
right panel, with "Layout and blocks can only change in code". Now, as in Shopify's editor:

- Layers lists each block under its section (`liquid-section-blocks.tsx`): "Add block" first
  (a menu of the schema's block types; `@theme` opens the theme's own `blocks/`), each block by
  its own text with its type after it, drag to reorder, eye to hide (`disabled`), ⋯ duplicate /
  remove. Logic in `lib/customize-liquid-tree.ts` (tests beside it); every change is one Puck
  `replace` of the section's props, so one undo step.
- Clicking a block opens `liquid-block-inspector.tsx`: "‹ Section" back, the block's name with
  hide/remove, and only that block type's settings. Which block is open lives in
  `LiquidBlocksContext` (`imported-theme-provider.tsx`, with the theme's editor fields).
- The section's own inspector no longer lists its blocks (`liquidSectionConfig.resolveFields`
  drops `blocks`); the blue note now points at Layers.
