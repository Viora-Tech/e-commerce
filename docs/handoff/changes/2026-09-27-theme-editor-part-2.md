# Theme editor, part 2

**Theme editor, part 2** (27 September 2026, `feat/editor-part2-finish`, no migration):
Shopify-style Sections sidebar (collapsible Header / Template / Footer groups; rows with drag
handle, blocks toggle, eye and a ⋯ menu for Duplicate / Rename (`props._name`) / Remove; an
insert line with "+" between any two rows, and on the canvas between sections, both inserting
at that exact index via `insertActions` in `apps/admin/src/lib/customize-insert.ts`; blocks,
meaning a section's array-field items, nested under it with "Add block"). Link picker: one
search across products, collections, pages, blog posts and policies, drill-down, recent
picks, validated "Paste a link", an "Open in a new tab" switch (`newTab` on link objects),
shown as a chip. Image picker: drop-to-upload, alt text, focal point (`focal: { x, y }` in %,
applied by blocks as `object-position` via `focalStyle`), Replace / Remove, and the media
dialog's "Recently used" strip, arrow-key grid and `<Picture>`/ThumbHash thumbnails
(`listMedia` now returns `variants` and `thumbhash`). Editor motion tightened to 150 to 220 ms
with no overshoot. Also carries part 2's WIP (ten new sections, grouped section settings,
scroll-to-new). Data shapes and internals: developer docs, Building, "Theme editor". Next on
this editor: dynamic sources (`{ "$source": "…" }`) on the same link and image fields;
migration 0074 is reserved for that follow-up.
