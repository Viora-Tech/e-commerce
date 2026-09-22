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

## Deviations (real data or missing frames)

- Sidebar wordmark: the store name and switcher replace the DealPort logo.
- Sidebar items follow the Shopify route map, not the kit's demo menu.
- Dashboard "Sales by country" `5:1618` shows sales by Indian state (no geo data beyond the shipping address).
- Dashboard "Add New Product" panel `5:2288` is replaced by Low stock (the kit's panel is a category picker with no counterpart here).
- Order list keeps a Customer column the kit lacks; the Product column is 260px (kit 203px) so real titles fit on two lines.
- Order ids are `#3` rather than `#ORD0001`; dates are `21-09-2026`.
- Status glyphs use Hugeicons stroke (PackageDelivered, PackageOpen, DeliveryTruck, PackageRemove, CheckmarkCircle) via `@commerce/ui/icons`; the kit mixes several icon sets. All admin icons come from that module, 1.25rem at stroke 1.5.
- Tiles show "No change" instead of a percentage when the previous window is zero.
- Customers, order detail, settings index, login and store picker have no frame in the kit; they reuse the card, table and form patterns above.

## Screens still needed from the kit

Frames for these exist in the kit but could not be enumerated from the page listing (the Cover page only exposes the thumbnail): customers list, product list, add product, coupon codes, transactions, login. A node link for each will let them be reproduced directly.
