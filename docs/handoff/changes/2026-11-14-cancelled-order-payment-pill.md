# Cancelled orders drop the "Payment pending" pill

- Shopper account order list and order page: a cancelled order that was never paid (`pending`,
  `cod`) shows only "Cancelled". Paid, refunded and failed payments still show their pill.
- Helper: `paymentPillShown` in `apps/storefront/src/data/account.ts`.
