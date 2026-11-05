# Order confirmed waits for the money

Fixes #1130. `order.placed` went out when the order was created, before the gateway opened, so
closing Razorpay still sent "Order confirmed". A gateway checkout (`paysOnlineAtCheckout`) now
writes it from `recomputeOrderStatuses` on the first captured or authorised money, and that
`order.paid` carries `notifyCustomer: false`, so the shopper gets one message. The merchant alert,
automations and placed-trigger pixels move with it. COD, manual and zero-total orders are unchanged.

A gateway checkout that never got its money now shows in Abandoned checkouts as well
(`convertedToSale`), and leaves the list once paid. Manual UPI and bank orders stay real orders from
Pay. The Payment pending tab is unchanged. The recovery link for these carts is not tested yet.
