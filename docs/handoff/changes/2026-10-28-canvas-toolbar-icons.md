# Customize: the section toolbar's icons show on imported themes (#906)

The canvas toolbar (move, duplicate, delete, Ask AI, more) renders inside the store's page.
Glide's unlayered `button { color; background }` beat the toolbar's layered Tailwind classes, so
the icons were near-black on the dark glass bar (the bar's `--foreground` was #fafafa, the
buttons computed rgb(31, 31, 33)). The toolbar buttons and the "more" menu items now mark colour,
background, border and padding important (`block-toolbar-bar.tsx`, `block-toolbar-more.tsx`),
as the storefront checkout does for the same reason; the delete and AI hover colours too.
Checked on the live canvas (Glide copy) with the same rules applied in the page.
