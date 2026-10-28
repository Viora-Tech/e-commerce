# reset-store-data: empty a store of test data before a fresh Shopify import

`scripts/reset-store-data.ts` removes everything a Shopify import brings back from one store,
so the store can be re-imported clean. The owner asked for this for Waimers on 28 Oct 2026,
because production held test orders and customers alongside the imported data.

## What goes

- **Catalogue:** products and variants with their options, images links, collections and
  memberships, extra-field values (metafields), content entries (metaobjects), channel
  listings and translations.
- **Orders:** orders with their lines, notes and addresses; payments and payment events;
  refunds; fulfilment orders; returns; GST invoices; notifications and outbox events.
- **Carts and promotions:** carts, discounts and their usage, gift cards and their
  transactions.
- **Customers:** customers with their addresses, sign-ins and sessions; newsletter signups;
  contact messages; consents and data requests. The privacy audit trail goes with them,
  under the same guard as Delete store (`app.store_delete`, migration 0078).
- **Stock and shipping:** stock levels and adjustments, transfers, purchase orders, inbound
  shipments, shipments and courier orders.
- **Content:** pages, blogs and posts, menus, URL redirects.
- **Records tied to the above:** reviews, back-in-stock signups, affiliate commissions and
  payouts, growth and automation runs, inbox conversations, AI jobs.
- **Earlier imports:** past import runs and issues, and the import mappings of everything
  above, so the next import creates fresh rows.

## What stays

The store and its settings, themes, Files (and their import mappings, so the next import
re-links product images instead of copying them twice), domains, staff and roles, apps,
payment and shipping setup, locations, markets, GST settings, automations and campaigns, and
the order-number counter.

## Usage

Dry run by default: every delete runs in the store's RLS-scoped transaction, which is then
rolled back, so the counts are exact and nothing changes. `--apply` commits.

    bun scripts/reset-store-data.ts --store <id|slug>           # dry run
    bun scripts/reset-store-data.ts --store <id|slug> --apply   # delete

It needs `DATABASE_URL` (app role, for the store-scoped wipe) and `DATABASE_URL_OWNER` (to
find the store). The worker image does not ship `scripts/`; the tasks image does.

## Tested

On the local dev database:

- A dry run on Waimers would delete 3,828 rows across 37 tables. Counts were unchanged
  afterwards.
- `--apply` on a throwaway copy took products, orders and customers from 74 / 72 / 17 to 0.
  Files (441), domains, staff and apps were untouched, and the dev database itself was
  unchanged.

## After running it

1. Run the Shopify import (Apps → Shopify import).
2. If the store uses the Meilisearch app, reindex.
3. To close a whole store instead, use Settings → General → Delete store.
