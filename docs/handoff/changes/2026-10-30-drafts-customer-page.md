# Draft orders and the customer page: picker, custom items, discount/shipping dialogs, GST, Create order, Email customer

From the owner's side-by-side audit with Shopify admin (items #27–#30, #80–#82). Committed
straight to `dev`. No migration.

## Drafts (`/orders/drafts/...`)

- **#27 Product picker.** The Products card's search box and a new **Browse** button open the
  shared `SelectProductsDialog` (browse without typing, product photos, Available count in red
  at 0, tick many variants, Add). Typing opens it with the text as the search
  (`initialSearch` prop, new). `products.pick` rows now carry `giftCard`. Picking a variant
  already on the draft adds one to its quantity. Draft lines are keyed by `DraftLine.key`
  (the variant id, or `custom:<uuid>`).
- **#28 Custom item.** "Add custom item" (`draft-custom-item-dialog.tsx`): title, price,
  quantity, GST on/off, optional HSN. Server: `DraftLineSchema` takes `custom` instead of
  `variantId` (exactly one of the two). Custom lines are booked against a hidden per-store
  product `__custom-item` (`core/order/custom-item.ts`, `ensureCustomItemVariant`): flagged
  `isSystemTest` (out of every product listing/report) and archived ("Duplicate order" skips it
  and names it as not copied), variant tracks no stock (routing reserves nothing). The line keeps
  its own title, price, `gst_rate_percent` (null = store rate, 0 = no GST) and `hs_code`.
  `getDraft` returns `custom`, `gstRatePercent`, `hsCode` per line. Discount codes: custom lines
  count toward order-wide codes, never product/collection-scoped ones.
- **Draft lines now snapshot the variant's GST rate and HSN** (`resolveLines`, untaxed
  variants at 0), as checkout does. Before, converting billed every draft line at the store
  default rate.
- **#29 Payment card.** Discount and shipping are lines with edit/remove, or "Add discount" /
  "Add shipping" links opening `draft-discount-dialog.tsx` (code checked like checkout, or an
  amount with a reason) and `draft-shipping-dialog.tsx`. `draft-discount-code.tsx` is gone.
- **#30 GST (estimated).** `orders.estimateDraftGst` → `previewDraftGst`
  (`core/order/draft-tax.ts`) → pure `estimateDraftGst` (`core/tax/draft-gst.ts`, tested).
  Prices always include GST (checkout extracts it; "add GST on top" is not built, see the
  Taxes page note), so the line reads "GST 18% (estimated) · Included in the prices" and the
  total does not change. Composition stores show nothing. Hook: `use-draft-gst.ts`.

## Customer page (`/customers/[id]`)

- **#81 Create order** in the header (and in the empty Orders card) →
  `/orders/drafts/new?customer=<id>` (`routes.orders.newDraft(customerId)`); the new-draft page
  loads the customer and fills contact + addresses (`draftForCustomer` in
  `draft-form-state.ts`, `addressesFrom` moved there from the customer card).
- **#82 Summary strip** under the header (`customer-summary-strip.tsx`, `StatStrip`): Amount
  spent (average), Orders (first order), Customer since, Last order. The Lifetime card
  (`customer-stats-card.tsx`) is removed.
- **#80 Email customer** opens `customer-email-dialog.tsx` (subject + plain-text message) →
  `customers.sendEmail` → `emailCustomer` (`api/services/customer-email.service.ts`) →
  `deliverEmailTo` with the new `customer_message` template (manual, email only, in Settings →
  Notifications' list). Logged in `notification` (shows under "Messages sent") and noted on the
  customer timeline ("Emailed: <subject>", author = staff email). No email channel set up →
  `PRECONDITION_FAILED` with a pointer to Settings → Notifications.

## Left / notes

- The empty `<Body>` for a blank intro/outro is now skipped in `TransactionalEmail`.
- A custom item opened from the order page links to the hidden product; harmless, not hidden.
- Not browser-tested (low-memory PC: no dev server). Verified with `bun run check:changed`.
