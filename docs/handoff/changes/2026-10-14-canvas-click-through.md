# Customize: clicks through a theme's invisible overlay still select the section

**Reported:** sections could not be selected in Customize. Not reproduced here.

**Likely cause** (from code reading): imported Shopify themes render full-page layers outside every section in their
layout, for example cart-drawer backdrops, page loaders and menu overlays. They are invisible but catch the click, so
it never reaches Puck's section and nothing gets selected.

**Fix:**
- `installCanvasInteraction` now checks each click. If it landed outside every section and outside Puck's own chrome,
  it finds the section under the pointer (`elementsFromPoint`) and re-sends the click there.
- The first time a layer does this, the console says
  `[customize] a click landed on <tag.class#id>, a layer outside every section…`. If selection still fails, that
  line names the element to look at.

**How to test:** Customize an imported theme (Zero Drift), click several sections (header, hero, product grid,
footer); each gets selected. Open DevTools → Console; any `[customize]` line names an overlay that was in the way.
