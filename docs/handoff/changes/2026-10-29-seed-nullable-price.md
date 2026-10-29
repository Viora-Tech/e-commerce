# Demo seeds skip variants without a price

Branch `fix/seed-nullable-price`. No migration.

- #929 made `variant.price_paise` nullable, which broke `packages/db` tsc in
  `src/seed-demo-drafts.ts` and `src/seed-demo-orders.ts`.
- Both demo seeders now leave out in-stock variants with no price (they cannot be sold), so
  demo orders, drafts and abandoned carts only use priced variants. With none left they stop
  with "no in-stock, priced variants to order/draft".
