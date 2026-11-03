# Authorised orders count as ready to ship

- `readyToShipWhere` (packages/api/src/services/order.service.ts), behind the sidebar Orders
  pill, the Orders page "Ready to ship" tile and Home's "need shipping": an open, unshipped order
  whose payment is **authorised** now counts, as Shopify's "Fulfill orders" does (the money is
  held and taken on shipping). The list's Delivery status reads "To ship" for it; Payment keeps
  the amber "Authorised".
- Shopify's Orders badge (50 on 4 Nov) is every **open** order, shipped or not; ours counts
  orders still to ship. Gap explained per order in the PR.
