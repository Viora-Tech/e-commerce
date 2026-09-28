# Admin layout fixes, product image reordering, media picker redesign, cookie banner width

**Admin layout, images and banner** (28 September 2026, `fix/admin-layout-images-banner`, no
migration).

- **Settings width**: `app/(admin)/settings/layout.tsx` is now the only place that sets the
  settings content width (one `max-w-4xl` column, centred beside the tabs). Pages no longer
  set their own `max-w-*` (Overview was full width, the rest `max-w-3xl`, data requests
  `max-w-4xl`, the payments wizard `max-w-2xl`). New settings pages: don't add a width.
- **DetailLayout** (`components/layout/detail-layout.tsx`, now a client component): side-column
  sections no longer shrink (`*:shrink-0`). Before this, in the height-capped sticky column,
  cards with `overflow-hidden` were squashed and drew over each other on the product page. The header sticks
  from `md` up only, so on phones it scrolls away. It publishes its live height as
  `--detail-header-height`, and sticky children and jump-nav targets use it
  (`scroll-mt-[calc(var(--detail-header-height,11rem)+1rem)]`, the timeline day label).
  A new `mainFooter` slot holds the order's floating next-step bar inside the main column.
  The order page now passes `stickySide`.
- **Order lines table**: SKU and variant get their own columns only when the section is at least 64rem wide (a
  container query). Narrower, they stack under the title, so quantity, price and total no
  longer scroll out of view at 1280 to 1440.
- **Product images**: `product-image-card.tsx`, `product-image-tile.tsx` and
  `product-image-pending.tsx` use `@dnd-kit` (MIT, now a direct dependency of the admin, same
  versions as `packages/ui`). Tiles don't move while dragging, because the 2×2 main image makes live shuffling
  overlap. The target shows a ring and a bar on the side where the image will land, and on
  drop Motion `layout` moves the tiles (off with reduced motion). You can drag the whole tile
  or use the grip with the keyboard (space, arrows, space), with screen-reader announcements.
  The saved order is `form.media` → `mediaIds` → `product_media.position`, unchanged. Also
  fixed: Replace put the new image last (it's first again), progress showed `0.4%` instead of
  `40%`, and duplicate library picks are skipped. Files dropped on the card upload into it.
- **Media picker** (`components/media/media-pick-*`, shared by the product page, the theme
  editor's image field and every other image field): it rendered at `sm:max-w-sm` (24rem)
  because the kit default beat `max-w-[64rem]`. It's now `sm:max-w-[64rem]` with a fixed
  height. It has an upload well styled like the #194 image field (Upload files and From URL
  as direct buttons), the whole body is a drop target, and uploads show progress bars with
  Retry and Dismiss. Multi-select shows numbered badges in pick order plus a Clear button,
  and a details pane (md+) shows a preview and lets you edit alt text, saved to the file.
- **Tailwind**: the admin now scans `packages/ui/src/**/*.{ts,tsx}`. `ROW_STATE_CLASS` lives in
  a `.ts` file, so sortable placeholder and lifted styles were never generated before.
- **Storefront cookie banner**: layout only; consent behaviour is unchanged. On phones it's
  full width with a 0.75rem gutter above the safe area. From `sm` it's a 24rem card in the
  bottom-left corner. Buttons share rows and wrap (`.btn` is `nowrap`), and long words break.

**Open**: at 320px the storefront header icons overflow the page (layout width 367px), so
fixed elements, the banner included, size to that. Media picker details pane is hidden on
phones (alt text there is edited from the gallery tile). `media-pick-dialog.tsx` is over the
300-line soft cap (it was already).
