# Glide theme sections in Puck, phase 1 (home page + inline editing)

Branch `feat/glide-theme-sections` (based on `fix/security-owner-decisions`; merges after #218,
#219, #220). No migration.

- **Inventory**: `docs/design/glide-theme-port.md` lists all 114 files in the Glide theme's
  `sections/` with status, the home page map, global settings mapping and the phase 2/3/4
  batches. The theme repo (`E:\Dev\Shopify\theme`) is read-only.
- **Ported**: the 14 home-page sections we had no equivalent for: ShipsToday, CategoryPanels,
  FeaturedCarousel, ReviewsShowcase, PromoBento, LatestDrop, DropsTeaser, PerfectMatch, BrandLab,
  LogoCarousel, DropReveal, NotesSeries, SocialWall, DiscordCta. Registry
  `packages/blocks/src/sections/glide.tsx` (Add panel group "Glide theme"); one config per
  section in `sections/glide/`, components in `components/sections/glide/`, copy in
  `data/glide/<name>.ts` (one file per section, beside `data/sections.ts`), BEM CSS in `styles/section-<name>.css`.
  Defaults come from the theme's `templates/index.json`; `shopify://` images become empty.
- **Inline editing**: `sections/inline-fields.ts` (`inlineText`, `inlineTextarea`,
  `inlineRichtext`). Body copy is Puck `richtext` HTML, drawn by `components/rich-copy.tsx`
  through `richtext-html.ts` (legacy plain strings escaped into paragraphs, HTML sanitised).
  The admin's `actionBar` override is now `canvas-action-bar.tsx`, which keeps Puck's inline
  B/I/U menu; `richtext` fields get the same frame as the Lexical field.
- **Shared owners extended**: `components/icon.tsx` gained 18 Glide icons (`IconName`,
  `isIconName`); `docs/conventions.md` documents the theme-port CSS exception and the inline
  editing rule; the `dangerous-html` sweep allow-lists `rich-copy.tsx`.
- **Not done / follow-ups**: header and footer groups (announcement bar, header, footer,
  newsletter, mobile dock, cookie banner, signup popup) are phase 2, with the product page.
  Older library/modern sections are not inline-editable yet. Reviews and social posts are typed
  in (no reviews/Instagram source). NotesSeries can't filter by series tag until `CardArticle`
  carries tags. FeaturedCarousel shows "Shop now" instead of the theme's variant picker and add
  to cart. Not checked in a browser: inline editing inside the Customize iframe and the B/I/U
  bar position need a look on localhost.
