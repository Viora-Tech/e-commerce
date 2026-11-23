# Order timeline names the payment gateway

Payment updates on the order timeline read "Gateway: payment.captured". They now say which gateway sent them and drop the dots: "Razorpay: payment captured", "Snapmint: ...". The name comes from `methodLabel(provider)` (`order-detail-types.ts`), the same names as the Payment card. Copy in `data/order-detail.ts` with the Hindi overlay. Owner request, 23 Nov.
