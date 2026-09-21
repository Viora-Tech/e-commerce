# Admin design audit

Scan + Diagnose pass from the `redesign-existing-projects` skill and section 9 (AI tells) of
`design-taste-frontend`, run on 2026-09-21 against the admin as of PR #25 plus the in-progress
`feat/admin-remove-polaris` branch. Read-only; fixes are grouped into PRs at the end.

Fixed constraints (not findings): shadcn Base UI + Tailwind v4 + Lucide, Inter (explicit choice),
green `#4ea674` as the single brand accent, Shopify IA, tokens from the Dealport frame
(`docs/design/admin-tokens.md`), Tailwind-only styling, no `useCallback`/`useMemo`/`memo`.

Severity: **high** = visible on every page or breaks a rule outright, **med** = visible on some
pages, **low** = polish.

## Typography

| # | Finding | Where | Sev | Fix |
|---|---|---|---|---|
| T1 | Two page titles on form and detail pages: top bar shows the section ("Products") and the page shows "Add product" / "Order #3" in the same 20/700 scale. | `components/layout/top-bar.tsx:66`, `components/layout/page-header.tsx:46`, `products/[id]`, `orders/[id]` | high | Top bar keeps the section title only on list pages; on detail pages it shows the breadcrumb trail ("Products / Add product") in 13px and the page keeps the single h1. One h1 per page. |
| T2 | Only 400/500/700 weights in use; 600 is never used, so card titles (700) and body (400) jump with nothing in between. | `packages/ui/src/styles.css` type tokens, `stat-card.tsx:77` | med | Card titles and table strong cells to 600; keep 700 for the page h1 and stat numbers. |
| T3 | Stat numbers are `tabular-nums` but table money columns are not, so totals wobble. | `resource-table/columns.tsx`, `orders-page.tsx` amount cell, `dashboard-cards.tsx` | med | Add `tabular-nums` to every numeric cell helper (one place: the `money` column helper). |
| T4 | Column headers are uppercase 12px with `tracking-[0.02em]`; the kit uses 13/500 uppercase. Minor, but headers now read lighter than the sidebar labels. | `styles.css` `--text-table-head` | low | 12px is fine at the new density; raise weight to 600 and keep tracking. |
| T5 | Empty-state body copy runs full card width on wide screens (>90 chars per line). | `components/layout/section-empty.tsx`, `empty-state.tsx` | low | `max-w-prose text-pretty` on the body paragraph. |

## Colour and surfaces

Saturation of every hex token (HSL):

| Token | Light | Sat | Dark | Sat | Note |
|---|---|---|---|---|---|
| `--primary` | #4ea674 | 36% | #5fbf87 | 43% | fine |
| `--link` / `--info` / `--chart-2` | #6467f2 | 85% | #8b8dff | 100% | over 80%, second accent |
| `--destructive` / `--chart-4` | #ef4343 | 84% | #f87272 | 91% | over 80% |
| `--warning` / `--chart-3` | #f5b400 | 100% | #f7c440 | 92% | over 80% |
| `--success` | #21c45d | 71% | #34d374 | 64% | ok |
| `--ink-strong` | #023337 | 93% | #f4f6f8 | 3% | teal-black on light, reads as a third hue next to `#23272e` |
| `--accent` / `--link-soft` | #f0f3ff | 100% | | | tint, acceptable |
| `--border-soft` | #e9e7fd | 85% | | | lavender hairline on a green product |

| # | Finding | Where | Sev | Fix |
|---|---|---|---|---|
| C1 | Two accents: green primary and indigo `--link` used for Details pills, previous-period values, inline links, chart line 2 and `Button variant="link"` (which uses green, so links are inconsistent with each other). | `stat-card.tsx:95-103`, `data-card.tsx:47`, `chart-card.tsx`, `button.tsx:19` | high | One accent. Links and Details pills use `text-primary`; keep indigo only as `--chart-2` and desaturate it to ~65% (`#7577d9`). Remove `--link`, `--link-soft`, `--accent-foreground` indigo from the palette. |
| C2 | Status colours exceed 80% saturation and are used at full strength for text on white (`text-destructive` on order actions, warning pill text). | `styles.css` status block, `status-pill.tsx` | med | Desaturate: destructive `#e05252`, warning `#e0a800`, and use the `*-soft` tints for pill backgrounds with darkened text (`color-mix(in oklch, var(--destructive), black 25%)`). |
| C3 | `--ink-strong #023337` is a saturated teal; page titles and stat numbers sit in a different hue from body text. | `styles.css:88` | med | Use a neutral near-black in the same grey family: `#1b1f27` (light), keep `#f4f6f8` (dark). |
| C4 | Dialog, sheet and alert-dialog overlays use `bg-black/50`; the only pure black in the UI, and the card shadows are pure black too (`rgb(0 0 0 / .12)`). | `alert-dialog.tsx:26`, `dialog.tsx:30`, `sheet.tsx:30`, `styles.css:81-82` | low | Overlay `bg-foreground/40` (tints with the palette); shadows `rgb(35 39 46 / .10)` light, `rgb(0 0 0 / .5)` dark stays. |
| C5 | Dark mode: `Button variant="destructive"` is `bg-destructive/10 text-destructive` and on `#1a1d24` cards it is almost invisible ("Cancel order", "Cancel shipment"). | `button.tsx` destructive variant, `order-actions.tsx:88`, `shipment-panel.tsx` | high | Dark: `dark:bg-destructive/25 dark:text-[#ffb4b4]`, or make destructive a solid button in both modes for irreversible actions. |
| C6 | `--border-soft #e9e7fd` is a lavender hairline used for card dividers inside a green/grey system. | `styles.css:113` | low | `#e5e7eb` (Neutral/200) so all lines share the grey family. |
| C7 | Flat surfaces everywhere: white cards on `#f9fafb` with a 1px `#dbdade` border AND a shadow. Border+shadow is the generic card look. | `card.tsx`, `styles.css --shadow-card` | med | Cards: shadow only on the canvas (`border-transparent shadow-card`), border only inside other cards. Sidebar rail keeps its border. |

## Layout

| # | Finding | Where | Sev | Fix |
|---|---|---|---|---|
| L1 | `PageBody` max width is not applied on list pages; tables stretch edge to edge at 1920px. | `page-body.tsx`, `orders-page.tsx`, `products-page.tsx` | med | `max-w-[1440px] mx-auto` on every page body; detail pages `max-w-[1120px]` with the Shopify 2:1 column split. |
| L2 | Uniform `rounded-full` on 27 elements (search pill, Details, tabs, filter buttons, avatars, save-bar buttons) while cards and inputs are r8. The kit uses pills only for tabs and Details. | `top-bar.tsx` (6), `products-page.tsx` (5), `orders-page.tsx` (3), `toolbar.tsx`, `pagination.tsx`, `product-form.tsx`, `customer-card.tsx` | med | Pills: status tabs, StatusPill, avatar. Everything else `rounded-lg`. Pagination and toolbar buttons use `Button size="sm"`. |
| L3 | Dashboard stat cards are three identical columns; the kit itself does it, but the third card ("Pending & cancelled") is a different shape, and on 1280px they wrap to 2+1. | `app/(admin)/page.tsx`, `dashboard-cards.tsx` | low | `grid-cols-[1fr_1fr_1.2fr]` at xl, 2 columns at lg, stack below; the third card gets its two numbers side by side. |
| L4 | Card padding varies: StatCard `px-5 py-5`, DataCard 24px, form cards `--card-spacing 1.25rem`. | `stat-card.tsx:74`, `data-card.tsx`, `globals.css .kit-form` (being removed) | med | One `Card` default of 24px (`p-6`) and a `density="compact"` variant at 16px for sidebar-column cards. |
| L5 | Vertical rhythm on detail pages: cards use `space-y-4` in the main column and `space-y-6` in the side column. | `order-view.tsx`, `product-form.tsx` | low | `gap-6` for both columns. |
| L6 | Top bar is 72px, kit 96px; with the 20px title it now looks squeezed. | `top-bar.tsx` root | low | `h-20` (80px) with the search pill at `h-10`. |
| L7 | Sidebar icon sizes mix `size-5` (items) and `size-4` (sub-items, collapse) with `size-3.5` in the theme switch. | `admin-sidebar.tsx`, `top-bar.tsx` | low | Items `size-5`, everything else `size-4`; switch icon `size-4`. |

## Interactivity and states

| # | Finding | Where | Sev | Fix |
|---|---|---|---|---|
| I1 | No `loading.tsx` anywhere and no `error.tsx`; every route falls back to a blank main area while `useEffect` fetches run. | `app/(admin)/**` (0 loading, 0 error files) | high | `loading.tsx` per section rendering the page skeleton (`ResourceTable` already has one; wrap it), one `error.tsx` at `(admin)/` with retry. |
| I2 | List pages fetch client-side in `useEffect` after mount, so the table appears empty, then fills. | `orders-page.tsx:101`, `products-page.tsx:106` | high | Fetch on the server in `page.tsx` and pass initial data; keep `nuqs` for filters. Show the skeleton while `isPending`. |
| I3 | Stat card kebab (`MoreVertical`) is a dead affordance: no menu, not a button. Same on ChartCard and DataCard headers. | `stat-card.tsx:80`, `chart-card.tsx`, `data-card.tsx` | high | Remove the icon until there is a menu, or wire a `DropdownMenu` with real items (View report, Change period). |
| I4 | Notification bell opens an empty popover with "No notifications". | `top-bar.tsx:88-97` | med | Hide the bell until notifications exist, or feed it the `notification` table (last 10 sent). |
| I5 | Save bar shows "Unsaved changes" with a warning icon the moment `/products/new` opens (dirty is `!product`). | `product-form.tsx:126` | med | On create, show the bar only once a field changes; label it "New product" without the warning icon. |
| I6 | `Card` has no transition; hover on clickable cards (settings grid, apps) is instant. | `card.tsx`, `settings-grid.tsx`, `apps-list.tsx` | low | `transition-shadow hover:shadow-md` only on cards that are links. |
| I7 | Focus ring is `ring-3 ring-ring/50` green on inputs, but sidebar items and StatusPill-adjacent links have no visible focus style. | `admin-sidebar.tsx:52-55`, `dashboard-cards.tsx:169` | med | Add `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` to sidebar item and inline link classes. |
| I8 | Delete flows use `AlertDialog` (good); status changes ("Mark as delivered") fire instantly with no undo. | `order-actions.tsx` | low | Sonner toast with an Undo action for reversible status moves. |
| I9 | No optimistic UI: after Save the form re-fetches and flashes. | `product-form.tsx` save handler | low | Keep the form state, apply the server response silently, toast "Saved". |

## Content

| # | Finding | Where | Sev | Fix |
|---|---|---|---|---|
| N1 | Em/en dashes in visible copy (banned): 10 occurrences. | `data/content.ts:15`, `data/customers.ts:10`, `data/discounts.ts:5`, `data/marketing.ts:5,10`, `data/orders.ts:84`, `data/products.ts:33` (`none: '—'`), `data/table.ts:15` (`${from}–${to}`), `components/orders/packing-slip.tsx:42`, `components/orders/shipment-panel.tsx:143`, `packages/notifications/src/templates/content.ts:49` | high | Rewrite with commas/colons; `none` becomes an empty muted cell; range `${from} to ${to} of ${total}` or `${from}-${to}`; templates `x2, ₹1,999`. Add a Biome/grep check in CI: `rg -n "[—–]" apps/*/src/data packages/*/src/templates`. |
| N2 | Mid-dot as a general separator in five places (order rows "#3 · Kuldeep Saini", SKU strings, refund lines, packing slip title). | `dashboard-cards.tsx:58`, `line-items-card.tsx:60-61`, `packing-slip.tsx:14`, `payment-card.tsx:89-90` | med | Separate columns or line breaks; at most one dot per line. |
| N3 | "Collections arrive in a later release." is a coming-soon in disguise. | `data/products.ts:144` | med | Drop the field until collections exist. |
| N4 | Home "Recent orders" has a "No" column (1., 2., 3.) copied from the kit; it carries no information. | `data/home.ts:24`, `dashboard-cards.tsx` | low | Remove the column. |
| N5 | Delta chips show "0 ↑ 0.0%" for cancelled when both windows are zero. | `stat-card.tsx` `DeltaChip` | low | Render "No change" in muted text when delta is 0 or previous is 0. |
| N6 | Seed data: owner user "Waimers owner", test order customer "Test Buyer". | `packages/db/src/seed.ts:77`, dev DB order #1 | low | Seed a realistic owner name from `SEED_OWNER_NAME`; demo orders use Indian names (Aarav Mehta, Ishita Rao) and organic amounts. |
| N7 | `data/provider-settings.ts:19` "Open Apps" is Title Case; everything else is sentence case. | `data/provider-settings.ts:19` | low | "Open apps". |
| N8 | Alt text: product thumbnails in Recent orders and Line items use `alt=""` although the image is the product. | `dashboard-cards.tsx:84`, `line-items-card.tsx:47` | low | `alt={title}`; keep `alt=""` only for the decorative fallback. |

No exclamation marks, "Oops", filler verbs, Lorem or `href="#"` found.

## Component patterns

| # | Finding | Where | Sev | Fix |
|---|---|---|---|---|
| P1 | Every card is border + shadow + white (see C7). | `card.tsx` | med | As C7. |
| P2 | Theme control is a sun/moon pill in the top bar and there is no "system" option. | `top-bar.tsx:101-117` | low | Move to the avatar menu as Light / Dark / System radio items; drop the pill. |
| P3 | Filled + outline pairs on every toolbar ("Export" outline + "Add product" filled, "Filter" outline + "View" outline). | `products-page.tsx`, `orders-page.tsx`, `toolbar.tsx` | low | One primary per page; secondary actions as `ghost` with an icon. |
| P4 | Avatars are circles with initials in `bg-primary-soft`; fine, but the sidebar user card and top bar draw them at different sizes (40 vs 36). | `admin-sidebar.tsx:205`, `top-bar.tsx:122` | low | One `Avatar size="sm|md"` from `packages/ui`. |
| P5 | StatusPill dots are semantic (order/payment/shipment state) and allowed; the Low stock list renders a pill per row, which is 6 dots in one card. | `dashboard-cards.tsx:166` | low | In dense lists show the count as text (`0 left`) coloured, no dot; keep dots in tables. |
| P6 | Details/View/Filter are hand-made anchor+span pills instead of `Button` variants, so hover/active/focus differ from real buttons. | `stat-card.tsx:99-105`, `data-card.tsx:47`, `chart-card.tsx:45` | med | `Button variant="outline" size="sm" render={<Link/>}`. |

## Iconography

| # | Finding | Where | Sev | Fix |
|---|---|---|---|---|
| G1 | Lucide throughout (accepted). Stroke width is Lucide's 2px everywhere except the kit-styled sidebar which needs 1.75 to match the reference weight. | `admin-sidebar.tsx` | low | `strokeWidth={1.75}` on sidebar icons. |
| G2 | `CircleAlert` in warning colour on the save bar for a non-error state. | `save-bar.tsx:34` | low | Use `Pencil`/`FileEdit` in muted colour, or no icon. |
| G3 | No favicon for the admin (Next default). | `apps/admin/src/app/` | low | Add `icon.svg` (store mark in primary). |

## Code quality

| # | Finding | Where | Sev | Fix |
|---|---|---|---|---|
| Q1 | Handwritten CSS: `.kit-form […]` override block and `.text-*` classes in `@layer components`. (Being converted on `feat/admin-remove-polaris`.) | `apps/admin/src/app/globals.css`, `packages/ui/src/styles.css:204-249` | high | `@theme` font-size tokens + cva variants; verify the branch removes both. |
| Q2 | Hardcoded `text-[12px]`/`text-[13px]` in 15 files instead of the scale tokens. | `admin-sidebar.tsx`, `top-bar.tsx`, `stat-card.tsx`, `data-card.tsx`, `chart-card.tsx`, `customer-card.tsx`, `payment-card.tsx`, `products-page.tsx` | med | `text-caption` / `text-body` utilities once they are `@theme` tokens. |
| Q3 | z-index is clean (10/20/50 from shadcn only). | `packages/ui` | ok | none |
| Q4 | `<img>` without `alt` in `media-card.tsx:25`. | `components/products/media-card.tsx:25` | low | `alt={m.alt ?? title}`. |
| Q5 | Main content lacks a `<main>` landmark on shadcn routes when the Polaris frame is bypassed. | `components/admin-frame.tsx` | low | Wrap the shadcn branch in `<main id="main">`. |

## Strategic omissions

| # | Finding | Sev | Fix |
|---|---|---|---|
| S1 | No skip-to-content link. | med | `<a href="#main" className="sr-only focus:not-sr-only …">Skip to content</a>` in `app/layout.tsx`. |
| S2 | No `not-found.tsx` for the admin; unknown ids render Next's default 404. | med | `app/not-found.tsx` using `EmptyState` with a link back to the section. |
| S3 | No `error.tsx` (see I1). | high | as I1 |
| S4 | Forms validate only on submit via zod on the server; no inline required/format hints before submit. | med | Client-side zod parse on blur for title, price, SKU, email; `FieldError` inline. |
| S5 | Keyboard: ⌘K palette exists, but no shortcuts for "New product"/"Save" and no visible hints. | low | `n` then `p` (Shopify style) later; not urgent. |

## Prioritised fixes

Following the skill's order (font → colour → states → layout → components → states → type polish).
Font is settled (Inter), so:

### PR A: palette and surfaces (small, global)
1. C1 single accent: remove indigo `--link`, Details/links on primary, chart-2 desaturated.
2. C2 desaturate status tokens; pill backgrounds from soft tints.
3. C3 neutral `--ink-strong`; C6 grey `--border-soft`; C4 tinted overlays/shadows.
4. C5 dark-mode destructive button contrast.
5. C7/P1 card = shadow only on canvas, border only when nested.

### PR B: states and dead affordances (medium)
1. I1/S3 `loading.tsx` per section + `error.tsx`; I2 server-side initial fetch on list pages.
2. I3 remove or wire the kebab menus; I4 bell hidden until it has data; I5 save bar only when dirty.
3. I7 focus rings on sidebar and inline links; P6 Details/View/Filter on `Button`.
4. S1 skip link, S2 `not-found.tsx`, Q5 `<main>` landmark.

### PR C: copy and layout polish (medium)
1. N1 em/en dash sweep + CI grep; N2 mid-dot separators; N3 drop "later release" field; N4 "No" column; N5 zero deltas; N7 sentence case; N8/Q4 alt text.
2. T1 one h1 per page (breadcrumb in the top bar on detail pages); T2 introduce 600; T3 tabular money cells.
3. L1 page max widths; L2 pill audit (`rounded-lg` except tabs/StatusPill/avatar); L4 one card padding + compact variant; L5 gap-6; L6 top bar 80px; L7 icon sizes.
4. Q2 replace hardcoded px sizes with scale utilities (after Q1 lands from the Polaris-removal branch).
5. N6 seed names; G2 save-bar icon; G3 favicon; P2 theme in avatar menu.

Out of scope here: storefront (own audit with the full `design-taste-frontend` skill), Puck and
Lexical internals.
