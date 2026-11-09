# Detail pages keep their side column in view; Razorpay's connect form asks for the key secret

The side column on detail pages (orders and the rest) used to stay in place only when it fit on the screen. A taller one, like an order's Customer, Invoices and Profit cards, now scrolls until its last card is in view and then stays there.

The install flow's Connect step listed only required fields, so Razorpay had no Key secret box. `ProviderField.connect` puts a field in that step without making it required, because the OAuth connection has no key secret. The step's intro now says testing charges nothing for a gateway, and books nothing for a courier.
