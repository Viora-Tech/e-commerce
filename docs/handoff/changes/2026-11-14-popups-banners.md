# Admin design audit: popups and banners (steps 9a–9e and 10)

Wave 1 of the admin design cleanup (audit of 14 Nov 2026, merge plan 6.2). Builds on #1688 (quick
wins) and #1691 (Orders list). Branch `design/popups-banners`.

## 9a. Confirm tone

- `ConfirmDialog` `tone` is required. The last 5 call sites that relied on the default pass
  `tone="default"`: rollouts Start now, Pause, Ship Treatment, Keep Control; affiliates Mark
  payout paid. The borderline confirms stay red (owner).

## 9b. ConfirmDialog on the shell

- `layout/confirm-dialog` is built on the popup shell (`layout/dialog-content`), not AlertDialog:
  left-aligned on phones, the title clear of the X (`pr-12`), a sticky footer, `role="alertdialog"`,
  never closes on a click outside, nothing closes it while it works.
- `settings/delete-store-dialog` is a ConfirmDialog with its typed check (now has the X; the
  "Deleting…" label swap became the button spinner).
- FormDialog `size="md"` / `"lg"` removed (27 callers, they did nothing). Sizes are the shell's:
  `standard`, `wide`.

## 9c. busy and dirty on the shell

- The shadcn `Dialog` root (`packages/ui`) takes a close guard; the admin shell registers it.
  `DialogContent busy` — Esc, a click outside and the X do nothing, the X is greyed.
  `DialogContent dirty` — those three first ask "Discard what you typed?" (Keep editing /
  Discard). The footer Cancel still closes straight away.
- 73 shell dialogs pass the busy state they already had (refund, cancel order, collect payment,
  bulk fulfil, return reject/receive/create, customer address, order contact, PO receive, GST
  registration and business, store credit, media, pixels, affiliates, …). FormDialog passes its
  own busy and takes an optional `dirty`.
- `dirty` on: refund (amount or reason), cancel order (reason), collect payment (reference),
  bulk fulfil (courier name or tracking), reject return (note), customer address (any field).
- Pickup drawer: cannot be closed while it books.

## 9d. Raw dialogs onto the shell

- Shell gets `size="full"` (`min(96vw,90rem)` × 92dvh) and `panel` (for pickers with their own
  scrolling panes: header and footer stop being sticky; children pad themselves).
- Moved off raw shadcn DialogContent (13): activity log, app permissions, stock history, media
  picker (wide panel), storefront navigation, resource picker (panel), AI writer, select products
  (panel), variant images (wide panel), purchase-document review (`full` panel; footer no longer
  runs past the edges), add section (keeps the 1rem phone gutter), dynamic source picker, single
  create shipment. Install steps and the bulk-ship edit dialog use the shell footer (sticky).
- Create shipment drawers: the dialog scrim (glass-scrim, dark aware) and the drawer motion tokens
  in `shadcn/drawer` (was bg-black/10 and 450ms); 1rem/500 titles; 1rem padding (was 2rem from
  md); outline dismiss buttons; the pickup drawer's buttons are [Later] [Create pickup],
  right-aligned. `BESIDE_SIDEBAR` kept.
- New sweep `popup-shell` (docs/guardrails.md ab): no raw `DialogContent`/`DialogHeader`/
  `DialogFooter` or `AlertDialog*` outside the shell and the command palette.

## 9e. Duplicates and labels

- One keyboard-shortcuts dialog (`layout/keyboard-shortcuts-dialog`); the theme editor's renders
  through it with its own list. Both close with an outline Close.
- One "What's this?" popover: `payments/whats-this` draws with `settings/whats-this-help`.
- Close is never filled: notifications preview is [Close] [Send test]; create shipment's Close
  (blocked and done steps) is outline.
- NDR dialog Cancel comes from shared copy (was hard-coded English).
- Hindi: 9 dismiss buttons that said कैंसिल / कैंसिल करें say रद्द करें.
- Popovers on 16/20/24rem with `max-w-[calc(100vw-2rem)]`: activity bell first, globe settings,
  query help, order lines, variant bulk bar, add section, link picker, product handle, template
  picker, theme colours. (Table and date-field popovers left to the tables/fields steps.)
- Bulk bars on ActionMenu: customers Add tag and Marketing, inbound shipments Change status
  (orders and products already were).

Not done in 9e (needs its own PR or an owner pick):
- SelectProductsDialog → ResourcePickDialog: the product picker has variant ticks, collection /
  type / status filters and locked rows that ResourcePickDialog does not have; folding them in is
  a feature port across 10 callers (drafts, POs, pre-orders, shipping profiles). It moved onto the
  shell instead.
- One version-history dialog: the library one (confirm before restore) and the editor one (Figma
  697:4526, "Now" row, Live tag) are two designs; the owner picks which wins.
- One bulk set-all: products (prices, status, scope) and customers (tags, note) have different
  models; a shared presentational dialog is a refactor of both sheets.
- Visual builder on Base UI Dialog: not in this step's list.

## 10. Banners

- `shadcn/alert`: `tone` = neutral | info | success | warning | danger on the status tokens, one
  radius and padding, `action` slot. `variant="destructive"` still works (= danger). Warning and
  danger announce as alerts, the rest as status (callers can pass `role`).
- NoticeBar = Alert neutral. NextStepBanner draws with Alert (action → info, attention → warning,
  done → success, closed → neutral), same layout.
- Moved to Alert: payments test strip, menu link check, product banner, bulk AI write, payments
  status, inbox AI active and hand-off, automation editor notices (2), Delhivery no pickup
  location, approvals save error / sent for approval, create-shipment weight note; removed the
  per-call `rounded-xl` / tints on email suppression, gateway keys and Razorpay website.

## Shared files outside the step

- `packages/ui/src/components/shadcn/dialog.tsx` (close guard, `closeDisabled`),
  `shadcn/drawer.tsx` (scrim, motion tokens), `shadcn/alert.tsx` (tones), `icons-more.tsx`
  (unused `KeyboardIcon` removed).

## Check in the browser

- Order page: Refund, Cancel order, Collect payment — press Esc while saving (stays), type then
  click outside (asks). Any delete confirm on a phone (left-aligned, X clear).
- Settings › Store data › Delete store.
- Orders › select several › Create shipment (drawer scrim, title, padding, footer) and Pickup.
- Products: media picker, variant images, Select products; Purchase documents review.
- Theme editor `?` and admin `?` shortcuts. Activity bell on a phone.
- Order Next step banner, product banner, payments status, inbox thread banners.
