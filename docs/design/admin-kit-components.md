# Admin kit components

Source: Dealport "E-commerce Dashboard" kit, file `m7I3nV2svzBSrW8PcnybiH`. Design-system pages:
Colors `8:33`, Typography `5:5870`, Space & Effect `5:6061`, Icon `11:127`, Element in Dashboard `14:99`,
Element in Landing page `11:186`. Every value below was read with `get_design_context` on the node and
converted px → rem (16px root). Family is Satoshi (user's choice; the kit uses Lato).

## Tokens (`packages/ui/src/styles.css`)

| Kit | Token | Value |
| --- | --- | --- |
| Ocean Green #4EA674 | `--primary` | brand, CTAs, active states |
| Cyprus #023337 | `--ink-strong`, `--brand-secondary` | titles, figures, table head labels |
| Surf Crest #C1E6BA | `--primary-tint` | hairlines, active page square |
| Aqua Spring #EAF8E7 | `--primary-soft` | table band, tab tracks, subtle backgrounds |
| Primary #6467F2 | `--link` (+ `--link-soft` #F0F3FF) | outline pills, inline links, progress fill |
| Success #21C45D / Pending #F0D411 / Error #EF4343 | `--success` / `--warning` / `--destructive` | status |
| Grey #7C7C7C | `--helper` | helper text |
| Neutral 50/200/300/500/600 | `--background`, `--secondary`, `--line`, `--muted-foreground`, Neutral/600 via `text-muted-foreground` | fills, hairlines, body |
| 1 Ambient `0 1 3 rgba(0,0,0,.2)` | `--shadow-kit-1` → `--shadow-card` | cards |
| 3 Ambient `0 1 8 rgba(0,0,0,.2)` | `--shadow-kit-3` → `--shadow-card-hover`, `--shadow-popover` | hover, menus |
| 6 Ambient `0 3 5 rgba(0,0,0,.2)` | `--shadow-kit-6` → `--shadow-dialog` | dialogs |
| Space 4 6 8 12 16 20 24 32 40 48 56 64 | Tailwind steps 1 1.5 2 3 4 5 6 8 10 12 14 16 | spacing |

Type tokens (`text-kit-*`): `display` 57/700, `h2` 32/400, `title` 18/26/700 -2%, `body-lg` 22/500,
`body-16` 16/500 lh 1.4, `stat` 32/38/700, `stat-tight` 32/32/700, `stat-sm` 24/22/700, `caption` 13/18/500,
`table-title` 16/22/600, `head` 15/500, `cell` 15/400, `name` 15/500, `price` 15/22/700, `label` 16/26,
`body` 14/17, `link` 14 -0.28px, `mini` 12, `field` 15, `value` 15/700, `button` 15/700, `chip` 12/500.

## Components

| Sheet node | Component | Props / variants |
| --- | --- | --- |
| 14:348 stat card (361×222) | `layout/stat-card.tsx` `size="lg"` | title, period, value, unit, delta, previous, detailsHref, menu, children |
| 14:847 stat card (270×135) | `layout/stat-card.tsx` `size="sm"` | title, value, delta, period |
| 14:357 delta | `layout/delta-chip.tsx` `size="kit"` | delta, invert |
| 14:363 / 14:832 Details pill | `layout/details-link.tsx`, `kit/kit-button.tsx` `variant="pill"` | href, label |
| 14:366 report card | `layout/chart-card.tsx` | title, periods, tabs, formatValue, menu |
| 14:403 stat tabs | `layout/stat-tabs.tsx` | items, active, onChange |
| 14:426 users card | `home/activity-card.tsx` | ordersLast24h, perHour, salesByState |
| 14:428 bar strip | `layout/mini-bars.tsx` | data |
| 14:508 progress line | `kit/kit-progress.tsx` | value 0..1 |
| 14:860 top products | `home/top-products-card.tsx` → `kit/kit-list-row.tsx` | href, image, title, meta, value |
| 14:865 / 14:988 search | `kit/kit-search.tsx` | size `card` / `toolbar` |
| 14:945 Add pill | `kit/kit-button.tsx` `variant="add"` | |
| 14:977 tab pill group | `layout/pill-tabs.tsx` `size="frame"` | tabs, value, onChange |
| 14:992 icon button | `kit/kit-icon-button.tsx` | label, children |
| 14:1006 table | `kit/kit-table.tsx`, `kit/kit-table-head.tsx`, `kit/kit-table-row.tsx` | columns (grid template) |
| 14:1029 thumb 40 / 14:874 thumb 56 / 14:918 thumb 46 | `kit/kit-thumb.tsx` | size `table` / `list` / `category` |
| 14:1037 payment dot | `kit/kit-dot-label.tsx` | tone |
| 14:1041 status glyph | `kit/kit-glyph-label.tsx` | icon, tone |
| 14:1636 field | `kit/kit-field.tsx` + `<Input size="kit">` / `<Textarea size="kit">` | label, help, error |
| 14:1629 / 14:1631 buttons | `kit/kit-button.tsx` `variant="primary"` / `"secondary"` | |
| 14:1708 edit chip | `kit/kit-button.tsx` `variant="chip"` | |
| 14:864 / 14:915 text links | `kit/kit-button.tsx` `variant="link"` / `"linkSm"` | |

Not yet built (values in the sheet, no page needs them today): payment-method card `14:1376`,
profile card `14:1538`, change-password form `14:1594`, upload-product-image `14:1489`, customer
info card `14:1296`, category chips `14:1354`, landing buttons/cards `11:186`.

## Dashboard `5:1346` mapping

Row 1: three `StatCard size="lg"` (Pending & cancelled uses `children`). Row 2: `ChartCard` +
`StatTabs` / `ActivityCard`. Row 3: `RecentOrdersCard` (dashboard table variant 5:2032) /
`TopProductsCard`. Row 4: `BestSellingCard` / `LowStockCard` (14:910 pattern). Deviations are logged in
`admin-frames.md`.

## The list page: one shell for every index screen

`layout/proofly-list-page.tsx` (`ProoflyListPage`) is now the shared shell for every list. The
kit shell described below (`kit/kit-list-page.tsx`) was removed on 14 Nov 2026 with the other
unused kit parts (week toggle, category and product rows, pagination); this section is history.
It was drawn to frames 5:2353 and 5:3936:

| Slot | What it holds |
| --- | --- |
| Heading row (48px) | `text-kit-heading` title, then a green primary and any outline secondaries |
| `strip` | Stat tiles (orders, products, collections) plus the category cards on collections |
| children | Always `ResourceTable size="frame"` |

`ResourceTable` already *is* the frame's card anatomy: a 24px-padded card holding the pill tabs,
the search and icon-button toolbar with its applied-filter chips, the tinted header band, 68px
rows, the selection bar and numbered paging. So the three pages share one table rather than each
drawing its own, and a column spec (`ResourceColumnSpec`) is all a page contributes:
`order-columns` in `orders-page.tsx`, `product-columns.tsx`, `collection-columns.tsx`.

The three differ only in what their data allows:

| | Strip | Tabs | Selection | Row actions |
| --- | --- | --- | --- | --- |
| Orders | 4 stat tiles | status | yes, bulk status | row click |
| Products | 4 stat tiles | status | yes, bulk status/tag/delete | row click |
| Collections | 4 stat tiles + category cards | featured / on sale / out of stock | off (the frame's rows carry their own edit and delete glyphs) | edit and delete glyphs |

## Drag and drop: `@commerce/ui/sortable`

Every reorderable surface in the admin sorts through one set of primitives in
`packages/ui/src/components/sortable/`, built on dnd-kit the way shadcn's dashboard-01 data table
is (`DndContext`, `closestCenter`, mouse/touch/keyboard sensors, `SortableContext` with
`verticalListSortingStrategy`, `CSS.Translate`). They share one timing, one overlay and one set of
row surfaces, so a drag feels the same on every screen.

| Primitive | Use it for | Notes |
| --- | --- | --- |
| `SortableList` | Flat vertical lists: product media order, variant options, collection products, table rows | Generic over `{ id }`; `renderItem(item, { handle, isDragging })`; `restrictToVerticalAxis` + `restrictToParentElement`; `onReorder(items)` |
| `SortableTree` | Nested lists (store menus) | Vertical drag reorders, sideways drag changes level (`indentRem` per level, `maxLevels` ceiling); a parent carries its children with a `+N` badge; `renderRow(ctx)` and `renderAfterGroup(parent)` for inline "add" rows |
| `DragHandle` | The grip on every row | Grip glyph from `@commerce/ui/icons`, focusable button, `aria-label` from the consumer, `cursor-grab` / `active:cursor-grabbing`, `lifted` state for the keyboard |
| `useDndSensors({ keyboard })` | Custom sortables | Mouse after 4px of travel, touch after a 200ms hold (6px tolerance), keyboard with `sortableKeyboardCoordinates` |
| `SortableOverlay` | The copy under the pointer | `DragOverlay` in a `bg-card` card with `shadow-popover` and a 1.02 scale; the source stays faint until the drop lands |
| `ROW_STATE_CLASS` | Row surfaces | `row`, `placeholder` (dashed primary outline on `primary-soft`, content at 40%), `lifted` (inset primary ring) |
| `@commerce/ui/sortable/tree` | Tree math, no React | `flatten`, `buildTree`, `projectDrop`, `moveNode`, `findNode`, `replaceNode`, `removeNode`, `appendNode` |

Timing is `SORT_DURATION_MS` (200ms) with `SORT_EASING` (`cubic-bezier(0.25, 1, 0.5, 1)`) for the
rows gliding aside and the drop animation alike. When the viewer prefers reduced motion the
transitions, the drop animation and the overlay scale are all off.

Keyboard: in `SortableList`, space picks up, arrows move, space drops, escape cancels (dnd-kit's
keyboard sensor). `SortableTree` turns that sensor off and runs its own lift on the handle, because
arrows there also change the level: up and down move one row, right nests under the row above, left
lifts out a level. Both announce every step through the consumer's labels (`SortableListLabels`,
`SortableTreeLabels`), which live in the screen's `data/<feature>.ts` like all copy.

Adopting it on a new screen: keep the row's content in its own component, render it from
`renderItem` / `renderRow` for both the list and the overlay (so they match exactly), put `handle`
first in the row, and pass copy for the labels. Next up: product media (`media-grid.tsx` still has
its own HTML5 drag), variant options, collection products, and `ResourceTable` rows where order
matters.
