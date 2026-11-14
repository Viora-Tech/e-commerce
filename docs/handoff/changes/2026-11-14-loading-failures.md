# Admin design audit 6a–6d: loading states, failures, submit loading

Owner approved the whole 14 Nov 2026 admin design audit; this is merge-plan steps 6a–6d
(audit sections 4, 4b and 6.2). Branch `design/loading-failures`. Builds on #1688 (quick wins)
and #1691 (Orders list: ListPageSkeleton, StatStrip loading, ResourceTable skeleton), which it
reuses rather than redoes. Visual and UX only; no data or permission changes.

## 6a. Skeletons from the real parts

- `layout/data-card-skeleton.tsx` (new): a real DataCard with a title bar, field bars and text
  lines. Used by every skeleton below and by cards that load on their own.
- `DetailPageSkeleton`: cards are DataCards (were `border p-6` divs), the header is
  `PageHeaderSkeleton` with the back line (title line 2.25rem, was 1.75rem), and a `frame` prop
  draws the loaded page's own shell: `detail` (ProoflyDetailPage), `order` (OrderPageFrame with
  the Next step card), `columns` (PageBody + PageColumns), `page` (ProoflyPageBody +
  PageColumns), `narrow` (52rem column), `full`. Also `main`, `side`, `back`, `actions`, `strip`
  (the customer page's 3-tile summary strip).
- `SectionPageSkeleton`: `cards`, `fields`, `title`/`subtitle`, `header={false}`. The settings
  pages now draw it (same defaults as the route loader) while their own data loads, so Settings
  no longer swaps one skeleton for a different one.
- `PageHeaderSkeleton`: new `back` option.
- ResourceTable rows already used TableSkeletonRows (#1691); nothing to do.
- 26 list loaders without a stat strip pass `tiles={0}`; gift cards `tiles={2}`, preorders
  `tiles={3}`.

## 6b. The right loader on every route

- 75 `loading.tsx` files: 43 new, 32 changed. Forms no longer inherit the list skeleton: blog posts,
  blogs, menus, redirects, metaobjects (type pages, new), collections, preorder campaigns, pages,
  files storage, segments, growth (overview, campaigns, automations), markets, rollouts,
  catalogs, preferences, SEO, drafts, returns, shipments/[id], order edit and ship, gift cards,
  stock forms, theme import. Lists that sat under a form-shaped parent get their own list loader.
- `analytics/analytics-skeleton.tsx` + `analytics/loading.tsx` (was Home's skeleton).
- `sales-channels/loading.tsx` (list shape, was Home's skeleton).
- `apps/app-page-skeleton.tsx` + `apps/[pluginId]/loading.tsx` (AppShell's header row).
- Themes skeleton: tab pill removed.
- `(editor)` loaders were already done in #1688.

## 6c. Failures and empties

- `hooks/use-load.ts`: `useLoad(load, deps)` → `{ data, failed, loading, retry, setData }`;
  `failed` is `'error'` or `'no-access'` (the API's FORBIDDEN). `states/load-failed.tsx` draws
  PageState (or InlineState with `size="inline"`) for it; no-access has no retry.
  `InlineState` gained a `no-access` kind.
- `lib/forbidden.ts` + `lib/api.ts`: the server `call` stamps FORBIDDEN errors with a fixed
  `digest` (Next keeps an error's own digest and blanks the message in production), and
  `RouteError` says "You do not have access" for it (and for a client FORBIDDEN).
  Shared file outside the step: `lib/api.ts` (`call` wrapper, same signature).
- No more skeleton forever on a failed read: payments, provider page, gateway connect, COD,
  shipping, checkout, store details, returns, costs, notifications, sender email, appearance,
  taxes, delivery providers form, GST invoice settings, S3 connect, staff (also no blank values
  while loading), monthly expenses, policy editor, custom data, inbox knowledge and quick
  replies. Account pages already handled failures.
- Home charts: a failed range read shows an error line with Try again and stops dimming.
- Cards that popped in: the profit card and (on shipped orders) the returns card draw a
  DataCard skeleton; Home suggestions hold their place for the one frame they wait.
- Left as they are: customer gift cards and email suppression notice. Both usually end up
  showing nothing, so a skeleton would turn the pop-in into a collapse on most customers.

## 6d. Submit loading

- 69 hand-placed button spinners → `loading` (4 of them sat in a button that already spun).
- 71 "Saving…" label swaps → `loading` with the idle label, so buttons keep their width.
- Button (`packages/ui` shadcn button, one class) hides the leading icon while its spinner
  shows, so an icon button does not grow when busy. Shared file outside the step.
- Per-action busy keys for the primaries #1688 left alone: affiliates codes and payouts,
  automation pause choice, delivery options save/preset, route setting, GST invoice detail,
  invoices list, review panel, review questions and review status, gift card toggle/resend/
  expiry/usage limit, email template save/update, growth recommendations, autopilot approve,
  metaobject entry, draft order, appearance, privacy request status, PO save and mark ordered,
  transfers, pickups, tracking link dialog. Order Book, PO Receive, payment reminder Mark paid
  and the rollout buttons only open a page or dialog, so they have nothing to spin (Book no
  longer spins on unrelated order-page work).
- 20 raw `Loader2Icon` → Spinner; 5 hand-written pulse spans → Skeleton; 15 grey slabs on app
  and privacy pages → DataCardSkeleton or SectionPageSkeleton.
- Not done: EditorLoading's `Bone` (editor loaders are out of this step), KitButton (step 7),
  the rich-text field's loading box (fields are another step), FormDialog/SaveBar
  `submitLabel` swaps (they already spin).

## Check in the browser

Settings → Payments, Shipping, Store details, Staff (one skeleton, then the page; offline: an
error with Try again); a staff member without a permission opening a page they cannot read
(server: "You do not have access"); Analytics overview first load; Inbox pages; blog post,
menu, collection, draft order, gift card, market and segment forms first load; an order page
(Next step card in the skeleton, profit card holds its place); Home with a slow range switch;
any busy button (spinner replaces the icon, the width stays).
