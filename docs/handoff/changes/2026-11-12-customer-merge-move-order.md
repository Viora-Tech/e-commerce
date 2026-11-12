# Merge customers, move an order to another customer, edit imported orders' contact (12 Nov 2026)

Issue #1625 (order #2445: the order's email was changed, the order stayed on the old customer, so
the shopper's account showed no orders). Branch `feat/customer-merge-move-order`.

## Merge customers

- Customer page › More actions › **Merge with another customer…**
  (`apps/admin/src/components/customers/merge-customer-dialog.tsx`, picker `customer-picker.tsx`,
  choices `merge-keep-choice.tsx`). Pick the other record, see what moves
  (`customers.previewMerge`), choose whose email, phone and name to keep, **Merge customers**
  (`customers.merge`).
- Core: `packages/core/src/customers/merge.ts` (`previewCustomerMerge`, `mergeCustomers`), one
  transaction. Both customer rows are locked in id order.
- Permission: `customers.write` + `customers.delete` (also-needs). Sensitive in
  `packages/api/src/mcp/action-catalogue.ts`; MCP action docs regenerated.
- Tables moved from the merged customer to the kept one: `order`, `customer_address` (the kept
  customer's default shipping/billing win; the others join unflagged), `cart`, `gift_card`,
  `discount_usage`, `customer_note`, `inbox_conversation`, `marketing_consent_event`,
  `marketing_message`, `marketing_automation_run`, `automation_run`, `cookie_consent`,
  `data_request`, `customer_identity`, `customer_passkey`, `product_view` (one row per product,
  later view kept), `metafield` (owner `customer`; kept customer's value wins), `discount.eligible_ids`
  (customer-limited discounts), and the app tables `review`, `review_question`,
  `affiliate_commission`, `affiliate` (moves only when the kept customer has no affiliate record;
  otherwise its account link is cleared). Deleted: the merged customer's `customer_session`,
  `customer_otp`, `customer_login_ticket` (its sessions stop working).
- Not moved: `store_credit_account` / `store_credit_entry` (see below), `privacy_audit_event` (stays
  with the stub; a `customer.merged` entry is written on both). Back-in-stock, newsletter and
  login codes are keyed by email, not customer.
- Store credit goes through `changeStoreCredit`: one debit line "Moved to … (customers merged)" on
  the merged record, and on the kept one a credit per still-open expiring credit (same expiry
  date) plus one for the money that never expires. Balances add up to the paisa; the ₹2,00,000
  cap refuses the whole merge if crossed. The ledgers are not combined row by row because expiry
  is replayed per customer (`openLots`) and mixing two ledgers would spend the wrong credits.
- Kept customer: chosen email/phone/name (falls back to the other's when the chosen one is empty),
  union of tags, both notes, GSTIN/business name and address snapshot when it had none. Consent
  per channel follows the latest recorded choice across both histories.
- The merged record stays as an erased stub (`anonymised_at`, new column `merged_into_id`) so its
  store credit history and audit trail keep an owner. Lists and stats leave it out; its admin page
  redirects to the kept customer. A second merge of it (double click) is refused.
- Migration **0243_customer_merged_into** (`customer.merged_into_id`, FK to `customer`).

## Move an order to another customer

- Order page › Customer card › ⋯ › **Change customer** (`apps/admin/src/components/orders/change-customer-dialog.tsx`)
  → `orders.changeCustomer` (orders.write + customers.write).
- Core: `packages/core/src/order/change-customer.ts` (`moveOrderToCustomer`, `emailOwnerForOrder`).
  Also moves the order's `discount_usage` and `affiliate_commission` rows. Timeline line on the
  order and on both customers. Refused when the order used the current customer's store credit.
- Contact edit: when the typed email belongs to another existing customer
  (`orders.findEmailOwner`), the dialog offers "This email belongs to … Also move this order to
  them?" (`email-owner-offer.tsx`), off by default → `orders.updateContact` `moveToEmailOwner`.
  Never merges.

## Imported orders: contact and addresses editable

- `orders.updateContact` (moved to `packages/api/src/routers/order-contact.ts`) no longer refuses
  imported orders. Lines, money and every other action stay read-only. A GSTIN or company name
  change on an imported order is refused (`lockTax`, `IMPORTED_TAX_LOCKED`); the dialog disables
  those two fields. `alsoUpdateCustomer: false` leaves the customer and their saved address alone,
  and nothing is sent to the shopper (test for order #2279's phone fix in
  `packages/core/src/order/contact.test.ts`).

## Customer email

- `customers.update` takes `email`; one another customer has is refused with CONFLICT
  (`existingId`), and the Edit dialog links to them and suggests merging.

## Tests

- `packages/core/src/customers/merge.test.ts`, `packages/core/src/order/change-customer.test.ts`,
  `packages/core/src/order/contact.test.ts` (#2279), `packages/api/test/customer-merge.test.ts`.

## Docs

- Merchant guide: `customers/customers.mdx` (email change, Merge two customers into one),
  `orders/orders.mdx` (email offer, imported orders, Move an order to another customer).
