# Admin design tokens

Source: Figma community kit "E-commerce Dashboard (Admin) UI Kits", file
`oYX0boJwzN8Hf2cGSpKRHs`, frame **Dashboard** `5:1346` (1440 × 1929).
Values below are what the kit actually uses (variables + hard-coded fills),
mapped to the semantic names in `packages/ui/src/styles.css`. Dark mode is
derived — the kit ships light only.

## Colour

| Token | Light | From | Notes |
| --- | --- | --- | --- |
| `--background` (canvas) | `#f9fafb` | var `Neutal/50`, frame fill 5:1346 | page canvas |
| `--card` | `#ffffff` | 5:1494 "Base", 5:2138 | cards, top bar, sidebar |
| `--foreground` | `#23272e` | 5:1498 card title, 5:1597 tab number | body text, titles |
| heading ink `--ink-strong` | `#023337` | 5:1502 stat number, 5:1367 page title, 5:2174 product name | big numbers / page title |
| `--muted-foreground` | `#6a717f` | var `Neutal/500` — 5:1495 period label, sidebar items, table header | secondary text |
| `--muted-foreground-soft` | `#8b909a` | 5:1598 tab caption | captions under numbers |
| `--muted` | `#f9fafb` | 5:1349 search pill | subtle fills |
| `--secondary` | `#e5e7eb` | var `Neutal/200` | chips, skeletons |
| `--border` | `#dbdade` | var `Light/Solid Color/Extra/Divider`, table cell borders | dividers |
| `--border-soft` | `#e9e7fd` | 5:1599 inactive tab underline | hairlines inside cards |
| `--primary` | `#4ea674` | 5:1390 active sidebar pill, 5:2141 Filter button, 5:1596 active tab underline | brand green |
| `--primary-foreground` | `#ffffff` | 5:1395 | |
| `--primary-soft` | `#eaf8e7` | 5:1360 theme-toggle track, 5:2146 table header band | tinted fills |
| `--accent-link` (`--link`) | `#6467f2` | var `Primary/500` — 5:1509 "Details" outline button, 5:1496 previous-period value | indigo for links / outline CTAs |
| `--accent-link-soft` | `#f0f3ff` | var `Primary/50` | |
| `--success` | `#21c45d` | var `Success/500` — 5:1508 delta, 5:2194 "Stock" | |
| `--destructive` | `#ef4343` | var `Error/500` — 5:2223 "Stock out", cancelled delta | |
| `--destructive-soft` | `#f87272` | var `Error/300` | |
| `--warning` | `#f5b400` | pending status dot (5:2046 row, sampled) | kit has no variable; sampled |
| `--chart-1` | `#4ea674` | area line 5:1573 | green |
| `--chart-1-fill` | `#4ea674` @ 10 % → 0 % | area gradient 5:1573 | |
| `--chart-2` | `#6467f2` | bar chart 5:1620 | |
| `--chart-3` | `#f5b400` | | |
| `--chart-4` | `#ef4343` | | |
| `--chart-5` | `#8b909a` | | |

## Typography

| Role | Font | Size / line | Weight | From |
| --- | --- | --- | --- | --- |
| Family | Kit uses **Lato**; we use **Satoshi** (Fontshare ITF FFL, self-hosted in `apps/admin/public/fonts/satoshi`, weight axis 300 to 900; chosen 2026-09-22 for a more distinctive feel than Inter) everywhere incl. table headers. Headings >= 1rem carry -0.01em tracking, stats -0.02em; figures use tabular numerals. | | | 5:1498, 5:2148 |
| Page title | Satoshi | 22 / auto, tracking 0.11px | 700 | 5:1367 |
| Card title | Satoshi | 18 / 26 | 700 | 5:1498, 5:2140 |
| Stat number | Satoshi | 32 / auto | 700 | 5:1502 |
| Tab number | Satoshi | 24 / 22 | 700 | 5:1597 |
| Tab caption | Satoshi | 13 / 18, tracking −0.26px | 500 | 5:1598 |
| Sidebar item | Satoshi | 16 / 22 | 400 (700 when active) | 5:1402, 5:1395 |
| Body / table cell | Satoshi | 15 / 22 | 400 (700 for names & money) | 5:2187, 5:2174, 5:2199 |
| Table header | Public Sans → Lato | 13 / auto, uppercase | 500 | 5:2148 |
| Caption / period | Satoshi | 14 / auto, tracking −0.28px | 400 | 5:1495 |
| Button | Satoshi | 16 / 26, tracking −0.32px | 400 | 5:1510 |
| Filter button | Satoshi | 14 | 400 | 5:2142 |

## Shape, spacing, elevation

| Token | Value | From |
| --- | --- | --- |
| `--radius` (cards) | 8px | 5:1494, 5:2138 |
| sidebar item radius | 6px | 5:1390 |
| pill buttons ("Details") | 50px, h 32, px 12, border 1px `--link` | 5:1509 |
| filter button | 8px, px 12 py 6 | 5:2141 |
| search pill | 30px, h 48, w 407, bg `--muted` | 5:1349 |
| avatar | 40px circle | 5:1365 |
| product thumb | 46px, radius 12 | 5:2171 |
| card padding | 20px | 5:1497 |
| card gap (grid) | 16–20px | frame layout |
| sidebar width | 260px, item px 14 + inner px 16 py 9, gap 8 | 5:1368, 5:1389 |
| sidebar section label | 24px tall block, 16px left | 5:1387 |
| top bar | 96px tall (we use 72px to save space), title at x 284 | 5:1347 |
| table header band | bg `--primary-soft`, radius 8, h 48 | 5:2146 |
| table row | h 54, cell px 20 | 5:2169 |
| status dot | 8px | 5:2193 |
| icon (sidebar) | 22–24px | 5:1391 |
| icon (kebab / chevrons) | 20px | 5:1499 |
| `--shadow-card` | `0 1px 3px rgba(0,0,0,.2)` (kit "1dp Ambient") | 5:1494 |
| `--shadow-toggle` | `0 2px 2px rgba(0,0,0,.14)` | 5:1361 |

## Dark mode (derived)

Canvas `#111318`, card `#1a1d24`, border `rgba(255,255,255,.08)`, foreground
`#e8eaee`, muted `#9aa1ad`, primary lifted to `#5fbf87`, link `#8b8dff`,
primary-soft `rgba(78,166,116,.16)`. Same hues, contrast-adjusted.

## Icons

Hugeicons stroke set (`@hugeicons/core-free-icons`) through `packages/ui/src/icons.tsx` (`@commerce/ui/icons`). Default 1.25rem, `strokeWidth` 1.5, sized with Tailwind `size-*`. Named exports keep the identifiers call sites use (`Home`, `Bell`, `ChevronDownIcon`); the `icons` map groups them by meaning for new code. Never import a glyph pack directly from a component.
