# Admin frames map

Every admin page is reproduced from a specific frame in the Dealport kit,
compared side by side at 1440px. Frames are read through the Figma MCP from
the copy at file `m7I3nV2svzBSrW8PcnybiH` (the community file
`oYX0boJwzN8Hf2cGSpKRHs` has the same node ids but no MCP access). Tokens
are in `admin-tokens.md`.

## Frame → route

| Route | Frame | Node | What it gives |
| --- | --- | --- | --- |
| Shell (sidebar) | Dashboard | `5:1368` | 260px rail, 14px gutter, 16/9 items, 6px green active pill, group labels at 24px inset, user card + "Your Shop" card |
| Shell (top bar) | Dashboard | `5:1347` | 96px bar, 407×48 search pill, 24px bell, 56×32 toggle, 40px avatar, 22/700 section title |
| `/` | Dashboard | `5:1346` | 3 stat cards `5:1494`, weekly report `5:1558`, users card `5:1618`, transactions `5:2032`, top products `5:2088`, best selling `5:2138`, add-product panel `5:2288` |
| `/orders` | Order Management | `5:2353` | heading + actions `5:2502`, four tiles `5:2511`, table card `5:2560`: tabs `5:2561`, toolbar `5:2571`, header band `5:2591`, row `5:2606`, paging `5:2856` / `5:2864` |
| `/orders/[id]` | (none) | — | built from the list row and card patterns above |
| `/products` (+ `/products/purchase-orders` empty state) | (none) | — | same table system as `5:2353` |
| `/products/new`, `/products/[id]` | Profile Update | `5:5480` | form card: 18/700 title, 15px labels 12px above 48px "Outline Input Field" (Neutal/50 fill, Neutal/200 hairline, bold 15px value), rows 24px apart, 42×120 buttons |
| `/settings/*` | Profile Update | `5:5480` | same form styling through the `size="lg"` field variants |
| `/customers` | (none) | — | empty state on the card pattern until customers exist |
| `/select-store`, `/login` | (none) | — | card pattern |

## Components measured from the frames

| Component | Frame | Measurements |
| --- | --- | --- |
| `Button` default | `5:5486` | radius 8, outline `5:5488` white with Neutal/200 hairline (size per the density table) |
| `Button size="lg"` | `5:2503` | page primary action with a leading glyph |
| `Button size="icon"` | `5:2576` | square, radius 4, Neutal/300 hairline |
| Tab group | `5:2561` | `#eaf8e7` track with 4px inset; active tab white, radius 6, 12/6 padding, 15/500 + count 14/700 green |
| Table header | `5:2591` | `#eaf8e7` band, 8px inset, radius 6, 40px cells, 15/500 `#023337`, centred |
| Table row | `5:2606` | 68px, Neutal/300 bottom hairline, 20px checkbox + row number, 40px product thumb (radius 4, Neutal/200) with the picture inset to 30px, 8px payment dot, 24px status glyph |
| Search | `5:2572` | 264×40, Neutal/50 fill, radius 8, 14px, 24px glyph |
| Paging | `5:2856`, `5:2865` | 42px Previous/Next with 24px arrows; 36px page squares, radius 4; active `#c1e6ba` bold |
| Stat tile | `5:2512` | 135px, 16px inset, 18/700 title, 32/700 figure with 16px arrow + 14/500 delta, 14px period line at 100px |
| Field | `5:5493`, `5:5495` | label 15/400 `#023337`, 12px gap, input 48px |

## Premium pass (24 September 2026)

Refines the Saleor look below; where they conflict, this section wins.

- Shell: warm neutral rail `--sidebar #f2f2f2`, ink `#141414`. The search field, View store and
  the notifications / theme / account group sit in the grey band ABOVE the white panel. The
  panel curves only at its top-left (hairline top and left) and runs flush to the window's
  right and bottom; the rail has no right border. List and detail headers are sticky and gain
  a faint shadow once `#main` scrolls (`data-scrolled`).
- Font: Geist (`next/font/google`). Icons: Phosphor via `@commerce/ui/icons` (import from
  `@phosphor-icons/react/ssr` so server components work); duotone in nav and section titles,
  `fill` on the active nav item, 16px inline / 18px nav.
- Buttons: `rounded-xl` (sm 0.625rem); ink primary is solid with a soft drop shadow and a
  border matching its fill (no light edge); outline buttons are white with a soft shadow.
- Cards: standalone `DataCard`s and summary boxes are `rounded-2xl` with `--shadow-card`
  (hairline plus a soft lift); inside `[data-layout=sections]` they stay flush.
- Labels: `.text-eyebrow` (11px, 500, uppercase, 0.06em) for field and section meta labels.
- Semantic tones (`--success|info|warning|danger` + `-soft`): mint for fulfilled, delivered,
  paid, active; blue for refunded and info; amber for placed, pending, unfulfilled; red for
  cancelled, failed, unpaid; drafts neutral. Used on status dots (tables), header pills,
  `IconBadge` squares and `LiveChip`s only, never as decoration.
- Tables: status as dot + text, relative dates via `<RelativeTime>` (full date on hover),
  tabular numbers, first column stacks name and sub-line with an avatar.
- Primitives: `IconBadge`, `CopyButton`, `LiveChip`, `RelativeTime`, keyboard shortcuts
  (`/` or ⌘K search, `N` new, `G` then O/P/C, `?` sheet) via `usePrimaryAction`.
- Dark mode is iOS-style: black shell and canvas, `#1c1c1e` cards, `#38383a` separators,
  `#8e8e93` secondary text, Apple dark system colours (green `#30d158`, orange `#ff9f0a`,
  blue `#0a84ff`, red `#ff453a`) on solid deep tints; primary buttons are light with black text.
- Avoid: gradients, glows, beams, sparkles, gradient text, heavy KPI card rows.

## Saleor look (September 2026)

The admin now follows the Saleor Dashboard (BSD-3) and its Macaw UI tokens (CC BY 4.0),
re-implemented on our shadcn/Base UI. The target is the user's reference screenshot of
Saleor's order detail (`C:/Users/kulde/Downloads/502626864-c9705611-2729-4e65-ae35-22081f03c569.png`).
Routes and IA stay Shopify-shaped. Credits: `apps/admin/THIRD_PARTY_LICENSES.md`.

- Shell: a light grey frame (rail) around a white content panel (hairline, rounded corners).
  A slim 48px header at the top of the panel holds the one search field (opens the command
  palette: records, actions, pages; also ⌘K and "/"), notifications, the switch-style theme
  toggle and the account menu. The rail: store switcher, groups with 36px rows, sub-items
  indented without a guide line, a light grey active pill, member row and View store.
- Colour: near-monochrome. Primary buttons and active states are ink (`--action`, Macaw
  buttonDefaultPrimary). The merchant accent (`--primary*`, `--ring`, `--chart-1`) is only
  for focus rings, checkboxes and selection, charts and small highlights. Links are ink and
  underlined. Status pills are a faint tint with a thin tone border.
- Type: large regular-weight headings (page title 1.75rem/400, section title 1.25rem/400),
  13px body and cells, 12px captions and table heads.
- `DetailLayout`: full-height main column plus a fixed right column divided by a 1px rule.
  Inside `[data-layout=sections]` the Card primitive is a flat, edge-to-edge section with a
  hairline under it, so `DataCard` and shadcn cards become titled sections. `DataCard` adds
  a grey meta line, a title glyph and `tone="muted"` for grouped sub-sections.
- `PageHeader`: square outlined back button, title with pills, grey meta line, actions
  (icon buttons first, the ink primary last).
- `KitListPage`: header on a hairline, an optional strip (`StatStrip` for summaries), the
  `ResourceTable` edge to edge: underline status tabs, search + Filter (count) + sort and
  columns, removable chips, a small ink header row, 44px rows, range and arrow pager.
- Fields: 36px controls, 6px radius, white on the `--input` hairline that darkens on hover.

The sections below record the earlier Dealport measurements; where they conflict, this
section wins.

## Global deviation: Shopify type scale and density

Layout, colour, card treatment, tab pill group, status icon + label, paging
style and sidebar grouping stay 1:1 with the frames. Type scale and density
follow the Shopify admin instead of the frame's px, and every size is
written in rem (Tailwind steps first; `text-[0.8125rem]` only when no step
exists; never px). Frame measurements are converted to rem before they go
into code.

| Thing | Frame | Shipped |
| --- | --- | --- |
| Page title | 22px/700 | `text-page-title` 1rem/600 |
| Card / section title | 18px/700 | `text-card-title` 0.875rem/600 |
| Body, table cells | 15px | `text-body` 0.75rem; primary cell text `text-body-strong` 0.8125rem/500 |
| Captions, table headers | 13-15px | 0.75rem/500 muted |
| Sidebar items | 16px, 40px rows | `text-nav` 0.8125rem/500, h-8; sub-items 0.8125rem indented |
| Stat numbers | 32px/700 | `text-stat` 1.25rem/600 |
| Table rows / header band | 68px / 56px | h-12 / h-10 |
| Card padding | 24px | p-5 (1.25rem) |
| Sidebar width | 260px | 15rem |
| Top bar | 96px | h-14 (3.5rem) |
| Buttons | 42-48px, 15/700 | h-8, text-xs/500; `size="lg"` h-9 for the page's primary action |
| Inputs | 48px | h-8 in toolbars, h-9 (`size="lg"`) in forms |

## Frame-size pages (no density overlay)

The dashboard (`5:1346`) and the order pages (`5:2353`) are drawn at the frame's
own px, converted to rem, with fluid width (the 1440 artboard is not a cap).
`ResourceTable size="frame"` and `PageBody width="frame"` carry the measurements:

| Element | Frame | Shipped (rem) |
| --- | --- | --- |
| Page heading | 22/26/700 (`5:2375`) | `text-kit-heading` 1.375/1.625/700 |
| Header actions | 142 x 48, 24px glyph (`5:2502`) | h-12 w-[8.875rem], `[&_svg]:size-6` |
| Stat tiles | 135 tall, 16 inset, 18/26 title, 32/34 figure, 13 period (`5:2512`) | h-[8.4375rem] p-4, `text-kit-title`, `text-kit-stat`, `text-kit-body` |
| Table card | 24 inset (`5:2560`) | p-6 |
| Tab pill group | 40 track, 32 tabs, 14 labels (`5:2561`) | h-10 p-1, h-8 `text-kit-cell` |
| Search / icon buttons | 264 x 40 / 40 x 40 (`5:2571`) | h-10 w-[16.5rem] / size-10 |
| Header band | 56, 13/500 (`5:2591`) | h-14 `text-kit-body` font-medium |
| Rows | 68, 14 ink, 40 thumb with 30 picture (`5:2606`) | h-[4.25rem] `text-kit-cell`, size-10 / size-[1.875rem] |
| Payment / status cells | 8 dot / 24 glyph, 8 gap (`5:2621`, `5:2624`) | size-2 / size-6, gap-2 |
| Pagination | 42 edge buttons, 36 squares (`5:2856`, `5:2865`) | h-[2.625rem] / size-9 |
| Order detail | no frame | kit cards (`DataCard size="kit"`, 18/26 titles, 14 body, 13 captions), 40px actions, Shopify order-page structure |

Products, customers and pages lists keep `size="compact"` (the density table above).

## Deviations (real data or missing frames)

- Sidebar wordmark: the store name and switcher replace the DealPort logo.
- Sidebar items follow the Shopify route map, not the kit's demo menu.
- Menus sit under Content (`/content/menus`), following Shopify's November 2024 move of navigation out of Online Store. Menu reordering uses up/down buttons rather than Shopify's drag handle (`⠿`); nothing in the kit covers either.
- The Menus page carries the header/footer assignment card. Shopify assigns menus in the theme editor's Header and Footer sections; this admin has no theme editor, so the storefront pointer (`store.navigation`, `main` + `footer` handles) is edited beside the menus it names. The card is a deviation, not a reproduction.
- Dashboard "Users in last 30 minutes" `5:1618` is real: the storefront sends a page-view beacon (`/api/beacon`, anonymous `wc_vid` cookie) into per-minute HyperLogLogs in Dragonfly; the card shows unique visitors and 30 per-minute bars. It reads zero until the storefront has traffic.
- Dashboard "Sales by country" (map + flags in `5:1618`) shows sales by Indian state with a two-letter badge in place of the flag and the order count in place of the geo delta (no country data beyond the shipping address).
- Dashboard "Add New Product" panel `5:2288` lists product types (with counts, linking to the products list filtered by that type) as the categories and the three newest products with an "Edit" pill; the kit's "Add" adds to a cart-like list that does not exist here. "See more" goes to the products list.
- Dashboard rows all use the 739 / 361 split (the frame's transactions row is 808 / 292) so the right rail aligns top to bottom; Low stock is an extra row under the frame's last one.
- Top-bar bell is the kit's outline bell without the red dot until there are unread notifications; the sidebar toggle is the kit's `arrow-menu-close` glyph, mirrored while the rail is collapsed.
- Order list keeps a Customer column the kit lacks; the Product column is 220px (kit 203px) so real titles fit on two lines. "Add order" opens Drafts (no draft-order form yet); "More actions" lists Drafts and Abandoned checkouts (no CSV export exists).
- Order ids are `#3` rather than `#ORD0001`; dates are `21-09-2026`.
- Status glyphs use Hugeicons stroke (PackageDelivered, PackageOpen, DeliveryTruck, PackageRemove, CheckmarkCircle) via `@commerce/ui/icons`; the kit mixes several icon sets. All admin icons come from that module, 1.25rem at stroke 1.5.
- Tiles show "No change" instead of a percentage when the previous window is zero.
- Customers, order detail, settings index, login and store picker have no frame in the kit; they reuse the card, table and form patterns above.

## Screens still needed from the kit

Frames for these exist in the kit but could not be enumerated from the page listing (the Cover page only exposes the thumbnail): customers list, product list, add product, coupon codes, transactions, login. A node link for each will let them be reproduced directly.
