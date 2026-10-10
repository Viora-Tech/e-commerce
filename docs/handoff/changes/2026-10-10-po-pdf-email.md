# Purchase order PDF, "Email to supplier", Hindi PO form, Select products picker (landed cost step 4)

- **PDF**: `loadPurchaseOrderSheet` + `PurchaseOrderSheet` (core `inventory/purchase-order-sheet.ts`,
  `po-sheet.ts`) and `renderPurchaseOrderToBuffer` (`@commerce/invoices/render`, template
  `src/purchase-order/purchase-order-pdf.tsx`). Buyer = the destination location's GST
  registration, else the default one, else the store. Goods only, in the order currency.
- **Email**: notification template `purchase_order` (to suppliers; email only) and
  `emailPurchaseOrder`: first email channel that accepts it, logged in `notification` with no
  order, optional mark-as-ordered in the same transaction (rolled back if the email fails).
- **API**: `purchaseOrders.pdf` (inventory:read) and `purchaseOrders.email` (inventory:write),
  both `heavy('bulk')`. `products.pick` variants now include `costPaise`.
- **Admin**: "⋯" menu on a saved purchase order (Print, Download PDF, Email to supplier),
  `EmailPoDialog`, lines added through `SelectProductsDialog` (`addPickedLines` in
  `form-state.ts`), and the whole PO form (`purchaseOrderFormContent`) in Hindi via `useCopy`.
- No migration.
- Docs: merchant guide "Purchase orders and landed cost" (Adding products, Print or email);
  developer data model "Purchase order PDF and Email to supplier".
