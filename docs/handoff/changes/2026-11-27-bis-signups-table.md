# Back in stock Signups: product and variant on two lines, columns keep their width

Branch `fix/bis-signups-table` (from `origin/dev`). No migration.

## What changed

- **Signups table (live since #1807).** Every column had an equal share of the fixed table and
  cells do not wrap, so long names ("ATK Blazing Sky F1 V3 Series Esports Wireless Mouse /
  Ultimate / Coral Pink") ran over the Contact column. The Variant column now takes 40% and
  wraps, like Products (`product-columns.tsx`) and Customers (`customer-columns.tsx`): the
  product name on up to two lines, the variant muted under it, the full label in the cell's
  title. Contact takes 26% and truncates with a title. Both name a `minWidth`, so on a narrow
  screen the table scrolls sideways instead of squeezing. File:
  `apps/admin/src/components/apps/back-in-stock/signups-list.tsx`.
- **API.** `backInStock.signups.list` also returns `productTitle` and `variantTitle` (null for a
  "Default" variant) and reads every row's names in one statement with `variantLabels`, not one
  query per row. The unused single-row `variantLabel` helper is gone
  (`packages/api/src/services/back-in-stock.service.ts`, `packages/api/src/routers/back-in-stock.ts`).

## Why every live signup says "Pending confirmation" (no behaviour changed)

- `pending_confirmation` is the double opt-in state: an email signup made while the campaign's
  "Ask shoppers to confirm" is on (the default) waits for the shopper to open the confirm link
  (`createSignup` and `confirmSignup` in `packages/plugin-back-in-stock/src/signups.ts`).
- Restock alerts go only to `confirmed` signups (`pendingSignupsFor` in `notify.ts`). A pending
  signup is never alerted. The Overview and the header count ("84 shoppers waiting") include
  pending ones (`analytics.ts`, `signups.ts`), so the count is higher than who will be told.
- These rows are not a Shopify import. "Bring over restock tags" (`restock-tags.ts`) inserts
  `confirmed` rows dated the day it runs. Rows dated 6 to 8 Nov are storefront signups made
  after launch, before the confirm email existed: nothing sent `back_in_stock_confirm` until
  a152aaec8 (#1587, deployed with the 12 Nov release 2b1314fc8). The fix writes the
  `back_in_stock.confirm_requested` event only for new signups, so every email signup made
  before that deploy is stuck: no confirm email, never confirmed, never alerted.
- One-off live data fix (owner to choose and run; not done here): see the report in the session
  for the SQL. Option A re-sends the confirm email to each stuck row by inserting one
  `back_in_stock.confirm_requested` outbox event per row. Option B marks them confirmed (they
  asked on the storefront and every alert carries an unsubscribe link).

## Tests

- Admin and API typecheck, Biome and `lint:components` run on this branch (see the commit).
  No new test: the change is layout plus a batched read already used by the export.

## Left to do / for the owner to check

- On localhost: Apps > Back in stock > Signups with long product names; the product sits on two
  lines with the variant under it and the masked email never overlaps.
- Decide the live data fix for the pre-12-Nov pending signups.
