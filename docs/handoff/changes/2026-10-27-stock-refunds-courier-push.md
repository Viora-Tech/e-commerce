# 2026-10-27 — Purchase orders, inbound tracking, refunds, inventory, courier order push

Fixes #822, #823, #824, #825, #826, #827, #828, #830. Migration `0176_stock_orders_batch` (additive).

## Purchase orders (#822–#824)
- `purchase_order.name`: the merchant's own name ("Diwali restock"), shown as "Name · #PO1" and
  in the list; search matches it.
- Editing after "Ordered" (`savePurchaseOrder`): products, quantities and prices change until the
  goods arrive; incoming stock follows the difference. A quantity cannot go below what arrived
  (`PO_BELOW_RECEIVED`), a line with arrivals cannot be removed (`PO_LINE_ARRIVED`).
- On an inbound shipment, line changes are refused (`PO_IN_SHIPMENT`): remove it from the
  shipment first (owner's rule).
- Received / closed: products and quantities fixed; unit prices and the FX rate can be corrected
  and `recost` revalues received stock. Only cancelled orders are fully locked.

## Inbound shipments (#825, #826)
- New columns: `carrier`, `tracking_number`, `tracking_url`, `expected_at`, `tracked_at`.
- `INBOUND_CARRIERS` (core `inventory/inbound-tracking.ts`, browser-safe via
  `@commerce/core/inventory`): FedEx, DHL Express, UPS, Blue Dart, Delhivery, Aramex, Other; the
  tracking link is built from the number when none is typed.
- `refreshInboundTracking` (api): when the carrier is connected as a shipping app (FedEx,
  DHL Express, Blue Dart, Delhivery), its `track()` gives `expectedDate`; runs on save and from
  "Check tracking". The owner has a FedEx account: connect it under Settings → Shipping.

## Refunds (#830)
- `refund.method` and `refund.gift_card_id`. `REFUND_METHODS`: UPI, bank transfer, cash,
  cheque, store credit, other.
- Refund dialog: "Back to Razorpay/Cashfree/…", "Already sent another way" (+ method), or
  "As store credit" (issues a gift card to the customer and emails the code).
- Fixed: the refund route wrote `refund.created` twice (service and router), which could send
  the shopper's refund message twice. Only the service writes it now.
- Cancel and edit-order refunds keep original / by hand / none (unchanged).

## Inventory (#827, #828)
- "Stock changed" filter: today, 7/30/90 days, or not in 90 days (from `inventory_adjustment`).
- "Show: SKUs | Products": a page of products with all their SKUs together, each still edited
  on its own row.

## Courier order push (owner: "push, don't book")
- `courier_order` table; `ShippingProvider.pushOrder` on Shiprocket (`/orders/create/adhoc`)
  and RapidShyp (`/create_order`). Worker job `{shipping}-order-push` every 5 min sends open,
  paid-or-COD, unpacked orders from the last 3 days to each such courier once
  (`stores_with_order_push_couriers()` SECURITY DEFINER lists the stores).
- Booking here with that courier reuses the pending order (`CreateShipmentInput.pushed`) when
  the whole order ships, then marks the row `booked`. Delhivery and others stay manual.
- Cancelled here: the same job first takes back pending orders whose order was cancelled
  (`cancelPushedOrder`: Shiprocket `/orders/cancel`, RapidShyp `cancel_order`); a refusal stays
  `pushed` with the reason and is retried next run.
- Order page side card "Courier apps": waiting there / booked / taken back / not sent (reason),
  with "Send again" (`orders.retryCourierPush`).
