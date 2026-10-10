# Customize: Pages and Media rail panels (A5)

Branch `feat/builder-pages-media`. No migration.

- Rail in the Figma order: Add, Pages, Sections, Media, Theme settings (`customize-rail.tsx`).
- Pages: `template-list.tsx`, extracted from `template-picker.tsx` and used by both; the editor
  passes it to `CustomizeLayout` as `pages`. Picking switches templates like the picker.
- Media: `media-panel.tsx` lists the store's images (search, "Show more", upload). Click puts
  the picture into the selected block (`mediaAction`, first empty picture setting else the first);
  drag onto the canvas drops into the block under the pointer (`lib/customize-media-drop.ts`,
  dashed outline while hovering). Pure helpers and test: `lib/customize-media-insert.ts`,
  `customize-media-insert.test.ts`.
- Hindi strings added for the new rail items and panel headers (`data/hi/themes.ts`).
- AI tab comes later.
