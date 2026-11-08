# Indexes for admin lists, Home and the order page (8 Nov 2026)

Migration **0231_admin_list_indexes** (hand-written, `packages/db/drizzle/`, journal idx 215).
Store rows are scoped by RLS, so a read whose index does not start with `store_id` scans every
store's rows. New btree indexes, all `IF NOT EXISTS`:

| Index | Serves |
|---|---|
| `customer (store_id, created_at)` | Customers list default sort (newest first), date filters, Home new-customer series |
| `product (store_id, created_at)` | Products list without a status filter, Home latest products |
| `order (store_id) where is_test` | the store-wide test-order count on every Orders list load |
| `inventory_level (store_id, variant_id) where fulfils_online` | `sellableStock` (Products list, Home stock counts) |
| `inventory_adjustment (store_id, created_at)` | Home stock-change series |
| `refund (store_id, created_at)` | Home and Analytics refunds in a date range |
| `payment (store_id, provider, created_at)` | Store health: a gateway's latest payment |
| `payment_event (store_id, received_at)` | order page payment history (PR "order page reads its record once") |

Not added on purpose: trigram (`pg_trgm`) indexes for `%search%` on orders/customers/products.
They need the extension and are bigger; a follow-up should decide between them and Meilisearch.
