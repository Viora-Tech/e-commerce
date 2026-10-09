# Admin redesign: leftover gaps B (apps, payment connect, Hindi)

Branch `feat/proofly-gaps-b`. Presentation only; no handler, request, redirect, OAuth or key handling changed.

## Apps pages on the shared pieces
- GST invoices list, queue and returns: `ProoflyPageHeader`, tables in a `surface-card`, Proofly cell
  classes (`gst-invoices/table-classes.ts`), status chips centred (`StatusLabelChip`, returns uses
  `StatusChip`). Invoice detail: header with back link and status chip, `SettingsCard` sections.
  Not done: rows-per-page on the invoices list. It pages with Previous/Next and the API has a fixed
  page size of 25 and no total (`gstInvoices.list`), so it needs an API change first.
- EMI settings and Back in stock settings: `SettingsCard` + `SettingsRow`, save as the header key button.
  EMI status line is a `surface-banner`. Back in stock overview: usage card + table card.
- Back in stock signups and Forms submissions: now `ResourceTable` with search, status chip centred and
  rows-per-page. They load every row once, so search and paging are client side.
- Message app connect (SES, WhatsApp): "View setup guide" link to `siteConfig.urls.docs` in the header
  (new optional `headerActions` on `ProviderSettingsForm`).

## Razorpay and Cashfree connect
`GatewayConnectPage` has the courier wizard header (app logo, title, intro, "View setup guide"), and
`GatewayConnectForm` takes a `twoColumn` prop: steps in one card, mode / one-click / keys / webhook /
Test and Save in the other. The setup wizard still uses the one-column form. JSX moved only.

## Hindi
New `data/hi/staff.ts` and `data/hi/notifications.ts` (registered in `data/hi/index.ts`). Filled the
`untranslated` blocks for inventory (filters, cell, bulk, history, export), collections (heading,
tabs, columns, tiles, sort labels), discount form, report columns and labels, funnel, growth
(view, sources, channels, campaigns, shortcuts), automation editor (tiles, trigger, steps, runs, delete)
and campaign tiles. The staff, notification and message-app components read `copy` at module scope
(English only); they now use `useCopy`, so the overlay takes effect. Left `untranslated` on purpose:
`href` values and the Settings home route links.
