# Theme editor UX and storefront polish

**Editor** (`apps/admin/src/components/themes/customize`, `lib/customize-canvas-events.ts`, `lib/customize-field-target.ts`)
- Click to edit: a click on a heading, text, button or image on the canvas selects the block and scrolls the inspector to that field with a short ring, then focuses it (not while the text is being edited in place). `fieldForClick` matches the clicked words or picture (any size or format) against the block's props; list props (slides) match as the list. Fields carry `data-inspector-field`.
- Inline image picker: a second click on an image of the selected block opens that field's media picker (`data-image-pick` on ImageField's button).
- Ask AI on the floating block toolbar: opens the AI panel aimed at the block, with quick actions (rewrite, shorter, Hindi, better heading) while that block stays selected. Canvas and panels talk through window events (`customize:focus-field`, `customize:ask-ai`).

**Storefront**
- Product page: Shipping & delivery and Returns & refunds panels linking the store's published policies (`showPolicyPanels`, on by default; a merchant panel with the same subject wins).
- Related products: the product's own collections first (catch-all ones skipped), then same type, then the rest (`lib/related.ts`).
- Sort: a theme-styled menu (keyboard, click outside), the plain select until hydrated and without JavaScript.
- Filters: "Type of item" (Products / Gift cards) when a listing mixes both (`filter.p.gift_card`, chips included).
