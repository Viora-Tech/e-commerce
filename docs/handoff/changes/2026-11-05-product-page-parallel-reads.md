# Product page reads run together

React Doctor's `async-parallel` rule named many storefront reads as waiting on each other. Most of them are not worth changing; these two were.

- `products/[handle]/page.tsx`: reviews, page extras, UPI discount, EMI offers, back in stock and policy panels now run in one `Promise.all`. The legacy EMI read still waits, because it needs the EMI result.
- `lib/template-render.tsx`: image media, the blocks config and the Liquid split now run in one `Promise.all`.
- Measured on a seeded local Postgres, five of the product page's store reads on a cache miss: 18.4 ms one after another, 6.0 ms together (median of 300 rounds). On a cache hit nothing opens a transaction, so there is no gain. Not measured in production.
- A cold product page now holds up to six of the process's ten pooled connections at once, each for a few milliseconds. Extra renders queue in the pool.

Left alone on purpose:

- `lib/catalog.ts:191` and `lib/collections.ts:190`: every query is on one `tx`, so one connection, so no gain.
- `lib/cart-actions.ts:63`: only reads cookies and headers before the transaction, and it touches the cart.
- `layout.tsx`, checkout, thank-you and cart pages: they read cart, pricing or order data. The layout's reads are worth another look after launch.
