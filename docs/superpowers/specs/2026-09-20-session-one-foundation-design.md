# Session one: foundation — design

Date: 2026-09-20. Owner: Kuldeep. Status: approved in discussion, written for implementation.
Companions: `E:\Dev\Shopify\docs\platform-plan.md`, `E:\Dev\Shopify\docs\tech-stack.md`.

## Goal

Stand up the repository and the smallest slice of the commerce core that proves
the architecture: multi-tenant Postgres with row-level security, a domain
workflow with compensation, provider interfaces, and a worker process. No UI.

Success: `bun test` passes, `docker compose up` brings up Postgres and
Dragonfly, migrations apply, the place-order workflow reserves stock, takes a
fake payment, and unwinds correctly when payment fails. A query without a store
context returns zero rows.

## Not in scope

Plugin registry or manifests. Better Auth. Puck. Lexical. Razorpay. Storefront
and admin apps. Search. GST. Notifications beyond the interface.

## Repository layout

```
apps/
  worker/                 Hono on Bun: /health, one BullMQ queue on Dragonfly
packages/
  config/                 shared tsconfig, biome config, env schema (Zod)
  db/                     Drizzle schema, migrations, RLS helper, test for RLS coverage
  core/                   provider interfaces, store context, place-order workflow
  features/               empty in session one; convention documented in README
docker-compose.yml        postgres:17, dragonfly (--cluster_mode=emulated --lock_on_hashtags)
turbo.json, package.json (bun workspaces), biome.json, vitest.workspace.ts
```

Rule: `core` and `db` never import from `features` or `apps`. Features import
from `core` and `db`. Apps wire features in a single `features.ts` each. This
file is what becomes the plugin registry later.

## Tenancy

Shared schema. Every tenant-owned table has `store_id uuid not null references store(id)`.
RLS is enabled and forced on each such table with one policy:

```sql
create policy store_isolation on <table>
  using (store_id = current_setting('app.store_id', true)::uuid);
```

The application connects as a non-superuser role `app` that does not bypass
RLS. Migrations run as the owner role. `withStore(storeId, fn)` in `packages/db`
opens a transaction, runs `set local app.store_id = $1`, and passes the
transaction to `fn`. There is no way to query tenant tables outside `withStore`
except the deliberate `withoutStore` used by migrations and cross-store admin
jobs, which is named so it stands out in review.

Test: an introspection test lists every table with a `store_id` column and
asserts `relrowsecurity` and `relforcerowsecurity` are true and the policy
exists. A behaviour test inserts rows for two stores and asserts each store
context sees only its own.

## Schema, session one

`store` (id, slug, name, currency 'INR', created_at)
`product` (id, store_id, handle, title, status, created_at)
`variant` (id, store_id, product_id, sku, title, price_paise int, mrp_paise int nullable)
`inventory_level` (id, store_id, variant_id, on_hand int, reserved int)
`customer` (id, store_id, email, phone, name)
`cart` (id, store_id, customer_id nullable, status, created_at)
`cart_line` (id, store_id, cart_id, variant_id, quantity, unit_price_paise)
`order` (id, store_id, number, customer_id, status, subtotal_paise, total_paise, placed_at)
`order_line` (id, store_id, order_id, variant_id, quantity, unit_price_paise)
`payment` (id, store_id, order_id, provider, provider_ref, status, amount_paise)

Money is integer paise. Ids are UUID v7. Order `number` is per store, from a
`store.next_order_number` counter updated inside the workflow transaction.

Deliberately absent until needed: options, collections, addresses, tax lines,
shipping, promotions. They follow Medusa's shapes when they arrive.

## Core

### Store context

`StoreContext { storeId, tx }`. Every core function takes it as first argument.
Nothing in core reads a global.

### Provider interfaces

```ts
interface PaymentProvider {
  id: string
  createPayment(ctx, input: { orderId, amountPaise, customer }): Promise<{ providerRef, status: 'pending'|'captured' }>
  capture(ctx, providerRef): Promise<{ status: 'captured' }>
  refund(ctx, providerRef, amountPaise): Promise<{ status: 'refunded' }>
}
interface FulfilmentProvider {
  id: string
  isServiceable(ctx, pincode): Promise<{ serviceable: boolean, etaDays?: number }>
  createShipment(ctx, input: { orderId, address }): Promise<{ awb: string }>
}
interface NotificationProvider {
  id: string
  channel: 'email' | 'whatsapp' | 'sms'
  send(ctx, message: { to, template, data }): Promise<{ messageId: string }>
}
```

Session one ships `FakePaymentProvider` with a switch to succeed or fail, used
only in tests.

### Workflow runner

`runWorkflow(steps)` executes steps in order. Each step is
`{ name, run(state) => Promise<Partial<state>>, compensate?(state) => Promise<void> }`.
On failure at step N, compensations for steps N-1..0 run in reverse, each
error logged and not rethrown, then the original error is rethrown. The runner
is pure TypeScript with no queue dependency; it runs inside the caller's
transaction.

### Place-order workflow

Input: cart id, payment provider. Steps:

1. `loadCart` — cart with lines, must be `open`, must have lines.
2. `reserveStock` — for each line, `update inventory_level set reserved = reserved + qty where on_hand - reserved >= qty`; zero rows updated throws `OutOfStock`. Compensate: subtract.
3. `createOrder` — allocate order number, insert order and lines, totals from line prices. Compensate: delete order.
4. `createPayment` — call provider. Compensate: refund if captured.
5. `markCartConverted` — cart status `converted`.

Whole workflow runs in one `withStore` transaction, so most compensations are
also covered by rollback. The compensations exist because step 4 has a side
effect outside the database. Tests: happy path, out of stock at step 2, payment
failure at step 4 with stock back to original, compensation order.

## Worker

Hono app on Bun. `GET /health` returns `{ ok: true, db: bool, queue: bool }`.
One BullMQ queue `{system}:heartbeat` with a worker that logs. This proves the
Dragonfly flags and the process shape. No business jobs yet.

## Tooling

Bun 1.3, Node 22, TypeScript strict, Biome for lint and format, Vitest 4 with a
workspace file, Turborepo tasks: `build`, `test`, `lint`, `typecheck`,
`db:generate`, `db:migrate`. Tests that need Postgres use the compose database
with a `test` schema reset per run. `.env.example` lists every variable; the
env schema in `packages/config` fails fast on a missing one.

## Error handling

Core throws typed errors extending `CommerceError { code, storeId?, cause? }`:
`OutOfStock`, `CartNotOpen`, `PaymentFailed`. No HTTP concerns in core.

## Open decisions carried forward

Meilisearch timing, Bun as Next runtime, Tailwind 4 vs 3. None affect session one.
