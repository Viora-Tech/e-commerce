# Admin design audit: the quick wins

Owner approved the "quick wins" of the 14 Nov 2026 admin design audit. Shared parts only; no page
was redesigned. One commit per item on `fix/admin-design-quick-wins`.

## 1. Text box height

- `ui/input`: default `h-8` → `h-9` (2.25rem), the same as Select and Button. New `size="sm"` (h-8)
  for dense rows; `kit` is now an alias of `lg`.
- `ui/input-group` default `h-8` → `h-9` (MoneyInput, rupee field, SEO handle fields).
- `ui/native-select`: same height (h-9, sm h-8), radius, fill, shadow and text size as Select.
- Kept at 2rem with `size="sm"` because they sit next to a small button: analytics query AI input,
  GST buyer GSTIN, GST bulk HSN bar, email template rename.

## 2. One gutter, one side column

- ProoflyDetailPage, ProoflyPageBody and the 15 hand-copied page frames (analytics, bulk editors,
  growth, variant page, bulk write) pad `md:px-6` like PageBody (was `md:px-8`).
- PageColumns' side column is 23.5rem with `gap-6` (was 20rem / 22rem, `gap-5`), like
  ProoflyDetailPage and the order page.
- Not changed (refactor): PageBody's own `gap-5` and `pb-5 md:pb-6`, the hand-made two-column
  grids in `customers/segment-form.tsx` (22rem), `apps/delhivery/overview-page.tsx` (22rem),
  `apps/whatsapp/setup-page.tsx` (22.5rem), `privacy/data-request-detail.tsx` (20rem), and the
  shipment drawers' 2rem padding.

## 3. Spinners on primary buttons

- 73 primary buttons now pass their existing busy state to `loading` (money and order dialogs
  first; product header Save gets a `saving` prop from the form's save state so an image upload
  does not spin it).
- Left alone because the busy flag is shared with another visible action, so the wrong button
  would spin: affiliates codes approve, payouts create; automations pause "Finish" (next to the
  cancel-runs choice); delivery options save and preset, route setting save; GST invoice cancel,
  invoices email, review issue; reviews question publish; gift card expiry, usage limit and
  enable/disable; email template update; growth recommendation create, autopilot approve;
  metaobject entry save; draft convert; appearance save; privacy complete; PO receive and mark
  ordered; transfer ship and receive; payment reminder mark paid; order shipment panel book;
  pickups schedule.
- Order page Next step (Mark paid, Collect, Create shipment, Delivered) only opens a dialog or a
  page, so it has nothing to spin; the spinner is on the Collect payment dialog it opens.
- Still to do (audit 6d): 53 hand-placed spinners, 30 "Saving…" label swaps, KitButton (no
  `loading`).
- Dialogs that can still be closed mid-save: the hand-built shell (`layout/dialog-content`) has no
  busy hook, so none of the dialogs above was changed. Refund, cancel order, collect payment,
  bulk fulfil, edit review, order contact, customer address, return reject and receive, PO
  receive, GST registration and the rest wait for the shell's `busy` prop (audit 9c).

## 4. ConfirmDialog tone

- `tone` defaults to `default` (primary). The 90 call sites that relied on the red default:
  85 now pass `tone="destructive"` (delete, cancel, remove, uninstall, disconnect, discard, sign
  out, stop, turn off); 5 turn primary: rollouts Start now, Pause, Ship Treatment, Keep Control,
  and affiliates Mark payout paid.
- Kept red but borderline (owner to decide): payments "Turn off" (provider and last way to pay),
  affiliates "Replace the discount code", policy "Replace with template", email template replace.

## 5. Lists and editor loaders

- NDR and Pickups tabs: skeleton rows until the first answer; error with Try again on failure.
- Shipments workspace: a failed tab read shows the error in the table; a failed wallet read no
  longer says no courier is connected.
- Content › Pages: error instead of "No pages yet" when the read fails.
- GST queue: skeleton rows, error state, and a failed settings read no longer shows the GSTIN
  checklist.
- `(editor)/error.tsx` (RouteError), `editor/loading.tsx` (EditorLoading), `code/loading.tsx`
  (spinner). Create shipment keeps DetailPageSkeleton instead of its in-between spinner.

## 6. Dead code

- Deleted (0 importers each): `kit/kit-list-page`, `kit/kit-category-row`, `kit/kit-product-row`,
  `kit/kit-pagination`, `kit/kit-week-toggle`, `layout/filter-button`, `table/row-icon-cells`,
  `settings/settings-empty`, `media/media-grid`, `shipments/create-shipment/pickup-card`,
  `themes/theme-customizer`.
- Removed 13 unused `text-kit-*` tokens from `packages/ui/src/styles.css`.
- Now unreachable, left for the refactor: `media/media-sortable-tile`, `themes/customizer-top-bar`,
  `themes/theme-settings` (and `button-settings`, `setting-group` under it).
- MCP consent titles: `text-section-title` (not defined) → `text-page-title`. Still undefined
  elsewhere: `billing/current-plan-card.tsx` (2), `billing/unlimited-plan-card.tsx`,
  `apps/install/install-buy-step.tsx` (plan name and price, not page titles; left for the owner).
- Docs: `docs/design/admin-frames.md` (list shell, gutter, field height, the type table) and
  `docs/design/admin-kit-components.md`.

## Check in the browser

Settings forms and filter bars (text box next to a dropdown), product variant table, customer and
gift card pages (wider side column), product/discount/collection pages (gutter), order refund,
collect payment and bulk fulfil (spinner), rollouts confirm buttons, Shipments NDR and Pickups,
Content › Pages, GST queue, theme editor and code editor first load.
