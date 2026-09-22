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
| 14:369 week toggle | `kit/kit-week-toggle.tsx` | options, value, onChange |
| 14:403 stat tabs | `layout/stat-tabs.tsx` | items, active, onChange |
| 14:426 users card | `home/activity-card.tsx` | ordersLast24h, perHour, salesByState |
| 14:428 bar strip | `layout/mini-bars.tsx` | data |
| 14:508 progress line | `kit/kit-progress.tsx` | value 0..1 |
| 14:860 top products | `home/top-products-card.tsx` → `kit/kit-list-row.tsx` | href, image, title, meta, value |
| 14:865 / 14:988 search | `kit/kit-search.tsx` | size `card` / `toolbar` |
| 14:910 add new product | `home/low-stock-card.tsx` → `kit/kit-category-row.tsx`, `kit/kit-product-row.tsx` | href/image/label/count; image/title/price/action |
| 14:945 Add pill | `kit/kit-button.tsx` `variant="add"` | |
| 14:977 tab pill group | `layout/pill-tabs.tsx` `size="frame"` | tabs, value, onChange |
| 14:992 icon button | `kit/kit-icon-button.tsx` | label, children |
| 14:1006 table | `kit/kit-table.tsx`, `kit/kit-table-head.tsx`, `kit/kit-table-row.tsx` | columns (grid template) |
| 14:1029 thumb 40 / 14:874 thumb 56 / 14:918 thumb 46 | `kit/kit-thumb.tsx` | size `table` / `list` / `category` |
| 14:1037 payment dot | `kit/kit-dot-label.tsx` | tone |
| 14:1041 status glyph | `kit/kit-glyph-label.tsx` | icon, tone |
| 14:1280 pagination | `kit/kit-pagination.tsx` | page, pageCount, onChange |
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
