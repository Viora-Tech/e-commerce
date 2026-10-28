# Pricing revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New plan prices, a Scale plan, a monthly per-order fee bill after included orders, fair-use visit notices, stored (hidden) regional prices, and every page that shows pricing updated to match.

**Architecture:** Plans stay one catalogue in `packages/core/src/billing/plans.ts`. The fee is computed by a pure function over a month's orders and the store's *paid* plan periods (`plan_payment` rows with `status = 'paid'`). Because the paid periods are the input, the trial, grace and paused days carry no fee by construction, and the plan for any order is just the period that covers it. A new `usage_bill` table records each month. Its bill is a multi-line order on the platform sales store, made through the same `placeSalesOrder` path as plan bills. The hourly billing sweep runs the monthly step once per IST month.

**Tech Stack:** TypeScript, Drizzle + Postgres (RLS), oRPC, Next.js 16 / React 19 (React Compiler), Vitest, bun, turbo.

**Spec:** `docs/superpowers/specs/2026-10-28-pricing-revamp-design.md`

## Global Constraints

- **Prices (before 18% GST), in paise in code:**
  - Starter 49_900 / 4_99_000.
  - Growth 1_99_900 / 19_99_000.
  - Pro 4_99_900 / 49_99_000.
  - Scale 14_99_900 / 1_49_99_000.
- **Included orders:** 50 / 200 / 500 / 2,000.
- **Fee basis points:** 100 / 75 / 50 / 0. Scale charges no fee past 2,000 orders either.
- **Fair-use visits:** 25,000 / 100,000 / 500,000 / `null` (Scale is judged by hand).
- **AI credits:** Starter 500, Growth 3,000, Pro 8,000, Scale 15,000.
- **Scale extras:** staff 25, storage 100 GB, unlimited automations (`activeWorkflows: null`, `runsPerMonth: 200_000`, `connectors: true`), and every Pro feature, support `'priority'`.
- **Own it:** ₹49,999 one-time, ₹3,000/month care (12-month minimum), ₹7,500 optional setup. Sold only through "Talk to us", never self-serve.
- **Months** are IST calendar months. Use `startOfMonth` / `dayKey` from `@commerce/dates`, never `new Date().getMonth()`.
- **Which orders count:** not `draft`, not `cancelled`, `isTest = false`, and `paymentStatus` not `'refunded'`, each judged when the bill is made. COD counts. A part refund counts the whole order.
- **Fee base:** `order.totalPaise`, rounded per order with `Math.round(totalPaise * bp / 10_000)`.
- **Carry-forward:** a month whose fee plus carried-in amount is under 10_000 paise (₹100) is not billed. It is recorded as `carried`, and the amount goes into the next month.
- **Unpaid usage bills** never change `storePlan.status`. They are added to the next plan bill.
- **AutoPay** stores get usage bills as a pay link plus an email, like everyone else.
- **Regional prices** are stored but never shown: `REGIONAL_PRICING_LIVE = false`.
- **Old pricing claims** are removed everywhere: "₹49 per 100 orders" and blanket "0% transaction fee".
- **React:**
  - Follow the file structure in `docs/conventions.md`.
  - No `useMemo`, `useCallback` or `React.memo`.
  - Copy goes in `data/*.ts` with a Hindi overlay in `data/hi/`.
  - Tailwind only, sizes in rem, CSS variables (no raw colours).
  - No right-side drawers; admin layouts per `docs/design/admin-frames.md`.
- **Don't edit `packages/ui` root components.**
- **Migrations** are generated with `bun run db:generate`, then extended by hand (functions, `SELECT apply_store_rls();`), as in `packages/db/drizzle/0123_store_plan.sql`. The next number is `0178`.
- **Verify once at the end** (owner rule): `bun run lint`, `bun run typecheck`, `bun run test`, and build admin + www. Per-task test runs below stay narrow.
- **Commits:** normal hooks, never `-n`. Branch `feat/mirofish-findings` → PR into `dev`. The PR adds `docs/handoff/changes/2026-10-28-pricing-revamp.md`.

## Review Focus

1. **Upgrade mid-month.** Orders before the upgrade use the old rate and the old included count. Later orders use the new plan's included count, measured against the month's running count (Starter at order 60 → Growth makes orders 61–200 free). Test in Task 3.
2. **An order refunded or cancelled after the month ends, but before the 1st's sweep runs.** It must not be billed. If the sweep reruns on the same month, it must not bill twice (unique `(store_id, month)`). Test in Task 5.
3. **A store that never paid.** Trial only, then paused, with 400 orders, must get no usage bill. Test in Task 5.
4. **A carried amount followed by a store going quiet.** ₹60 carried with no orders the next month: the carry stays `carried` and never drops below zero or vanishes. Test in Task 3.
5. **An unpaid usage bill when the plan renews.** Its amount must appear as a line on the renewal bill. The old sales order is cancelled without the cancel hook marking the usage bill `cancelled`, and paying the renewal marks it `paid`. Test in Task 6.

---

### Task 1: Plan catalogue with Scale and fee fields

**Files:**
- Modify: `packages/core/src/billing/plans.ts`
- Modify: `packages/ai/src/plans.ts`
- Modify: `packages/config/src/site.ts:64-71,112-116`
- Modify: `packages/db/src/billing-schema.ts:20,57,…` (`STORE_PLANS` and the `in (...)` checks)
- Modify: `packages/db/src/ai-schema.ts:39,62`
- Create: `packages/db/drizzle/0178_scale_plan.sql` (generated)
- Modify: every file `bun run typecheck` flags for a missing `scale` key. Expected: `apps/admin/src/data/billing.ts`, `apps/admin/src/data/hi/billing.ts`, `packages/core/src/billing/emails.ts` (`PLAN_NAMES`), `packages/core/src/automations/types.ts` (`AutomationPlanTier`), and `apps/admin/src/components/billing/billing-page.tsx:68` (the downgrade ladder).
- Test: `packages/core/src/billing/plans.test.ts` (new)

**Interfaces:**
- Produces:
  - `PLAN_IDS = ['starter','growth','pro','scale']`
  - `PlanDefinition.feeBasisPoints: number`
  - `PlanDefinition.visitsPerMonth: number | null`
  - `planRank(plan: PlanId): number` (0–3)
  - `nextPlanUp(plan)`: `pro → 'scale'`, `scale → null`
  - `PlanAiTier` gains `'scale'`
  - `AI_PLANS` gains `'scale'`
  - `siteConfig.plans.scale`
  - `siteConfig.plans[*]` gains `feePercent: number` and `visitsPerMonth: number | null`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest'
import { nextPlanUp, PLAN_IDS, PLANS, planRank } from './plans'

describe('plans', () => {
  it('has the 2026-10-28 prices, orders, fees and visits', () => {
    expect(PLAN_IDS).toEqual(['starter', 'growth', 'pro', 'scale'])
    expect(PLANS.growth.pricePaise).toEqual({ month: 1_99_900, year: 19_99_000 })
    expect(PLANS.scale.pricePaise).toEqual({ month: 14_99_900, year: 1_49_99_000 })
    expect(PLAN_IDS.map((p) => PLANS[p].orders)).toEqual([50, 200, 500, 2000])
    expect(PLAN_IDS.map((p) => PLANS[p].feeBasisPoints)).toEqual([100, 75, 50, 0])
    expect(PLAN_IDS.map((p) => PLANS[p].visitsPerMonth)).toEqual([25_000, 100_000, 500_000, null])
    expect(PLANS.scale).toMatchObject({ staff: 25, storageGb: 100, ai: 'scale' })
  })
  it('ranks and steps up to Scale', () => {
    expect(PLAN_IDS.map(planRank)).toEqual([0, 1, 2, 3])
    expect(nextPlanUp('pro')).toBe('scale')
    expect(nextPlanUp('scale')).toBeNull()
  })
})
```

Add to `packages/ai` tests (or the existing plans test there): `expect(PLAN_QUOTAS.pro.credits).toBe(8_000)` and `expect(PLAN_QUOTAS.scale).toEqual({ credits: 15_000, calls: null, tokens: null })`.

- [ ] **Step 2: Run them to verify they fail.** Run `bun run --cwd packages/core vitest run src/billing/plans.test.ts`. Expected: FAIL (`scale` is undefined).

- [ ] **Step 3: Update the catalogue.** Apply the Global Constraints values to `PLANS`, `PLAN_QUOTAS`, `siteConfig.plans` and the db plan lists and checks. Then make `choosePlan` compare plans with `planRank` instead of month price, so a yearly Scale is never "cheaper".
  - Update the header comments: replace "memory-bank/pricing.md 2026-10-18" with the spec path.
  - Delete the old "kept until pricing is decided" sentence in `packages/ai/src/plans.ts`.

- [ ] **Step 4: Generate the migration.** Run `bun run db:generate`, then rename the output to `0178_scale_plan.sql`. Expected: `DROP CONSTRAINT` / `ADD CONSTRAINT` for `store_plan_plan`, `ai_settings_plan_check`, and any other plan check it finds, with `scale` in each list.

- [ ] **Step 5: Typecheck, and add `scale` to every map it flags.** Run `bun run typecheck`. Expected: PASS once every `Record<PlanId, …>` has a `scale` entry.
  - Hindi Scale name: `'स्केल'`.
  - The billing-page downgrade ladder steps down one rank.

- [ ] **Step 6: Run the tests.** Same command as Step 2, plus `bun run --cwd packages/ai vitest run`. Expected: PASS.

- [ ] **Step 7: Commit** with the message `feat(billing): Scale plan and 2026-10-28 prices, fees and visit limits`.

### Task 2: Regional price table (stored, hidden)

**Files:**
- Create: `packages/core/src/billing/regional-prices.ts`
- Test: `packages/core/src/billing/regional-prices.test.ts`
- Modify: `packages/core/src/billing/index` exports (wherever `plans.ts` is re-exported)

**Interfaces:**
- Produces:
  - `type PriceRegion = 'india' | 'tier1' | 'tier2'`
  - `type PriceCurrency = 'INR' | 'USD' | 'GBP' | 'EUR' | 'JPY'`
  - `REGIONAL_PRICING_LIVE = false`
  - `regionForCountry(countryCode: string | null): PriceRegion`
  - `regionalPrice(plan: PlanId, region: PriceRegion, currency: PriceCurrency, interval: BillingInterval): number | null`. This returns minor units: paise/cents/pence, or yen for JPY. It returns `null` for a pair the spec doesn't price, such as tier2 GBP.
  - `OWN_IT_PRICES: Record<'india'|'tier1'|'tier2', { licence: number; carePerMonth: number; currency: 'INR'|'USD' }>`

- [ ] **Step 1: Write the failing test**

```ts
it('maps countries to tiers', () => {
  for (const c of ['US','GB','DE','FR','JP','AU','CA','SG','AE']) expect(regionForCountry(c)).toBe('tier1')
  expect(regionForCountry('IN')).toBe('india')
  expect(regionForCountry('ID')).toBe('tier2')
  expect(regionForCountry('BR')).toBe('tier2')
  expect(regionForCountry(null)).toBe('india')
})
it('prices each plan per region and currency', () => {
  expect(regionalPrice('starter','tier1','USD','month')).toBe(1900)
  expect(regionalPrice('scale','tier2','USD','month')).toBe(19900)
  expect(regionalPrice('growth','tier1','GBP','month')).toBe(3900)
  expect(regionalPrice('pro','tier1','EUR','month')).toBe(11900)
  expect(regionalPrice('scale','tier1','JPY','month')).toBe(52_000)
  expect(regionalPrice('pro','tier1','USD','year')).toBe(129_000)
  expect(regionalPrice('growth','india','INR','month')).toBe(1_99_900)
  expect(regionalPrice('starter','tier2','GBP','month')).toBeNull()
  expect(REGIONAL_PRICING_LIVE).toBe(false)
})
```

- [ ] **Step 2: Run to fail.** Run `bun run --cwd packages/core vitest run src/billing/regional-prices.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement the table.**
  - Monthly prices come from the spec's tables. Yearly is 10× monthly.
  - India reads `PLANS[plan].pricePaise`.
  - Tier 1 is the EU-27 country codes plus US, GB, JP, AU, CA, SG and AE. Everything else that isn't IN is tier2.
  - The header comment says nothing reads this until a non-Indian gateway exists.

- [ ] **Step 4: Run to pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit** with the message `feat(billing): regional plan prices, stored and switched off`.

### Task 3: Per-order fee calculation (pure)

**Files:**
- Create: `packages/core/src/billing/usage-fee.ts`
- Test: `packages/core/src/billing/usage-fee.test.ts`

**Interfaces:**
- Consumes: `PLANS`, `PlanId` (Task 1).
- Produces:

```ts
export type FeeOrder = { id: string; placedAt: Date; totalPaise: number }
export type PaidPeriod = { plan: PlanId; start: Date; end: Date } // [start, end)
export type FeeLine = { plan: PlanId; basisPoints: number; orders: number; feePaise: number }
export type MonthFee = {
  ordersCounted: number   // orders inside a paid period
  feeOrders: number       // of those, past the included count
  lines: FeeLine[]        // one per plan that charged a fee, plan order
  feePaise: number        // sum of lines
}
export const USAGE_BILL_MIN_PAISE = 10_000
export function monthFee(orders: FeeOrder[], periods: PaidPeriod[]): MonthFee
export function billable(feePaise: number, carriedInPaise: number): { bill: boolean; totalPaise: number }
```

`monthFee` works like this:
- Sort the orders by `placedAt`.
- For each order, find the period with `start <= placedAt < end`. When periods overlap after an upgrade, take the latest `start`.
- Orders outside every period are skipped and not counted.
- The running count `k` increases over the counted orders. Order `k` carries the fee if `k > PLANS[plan].orders`.
- The fee is `Math.round(totalPaise * bp / 10_000)`. A Scale order past 2,000 still adds 0, so it gets no line.

- [ ] **Step 1: Write the failing tests** for these cases:
  - `skips orders outside paid periods (trial, grace, paused)`: 400 orders, `periods = []` → `{ ordersCounted: 0, feeOrders: 0, lines: [], feePaise: 0 }`.
  - `charges 1% on Starter after 50`: 60 orders of ₹1,000 → `feeOrders: 10`, `feePaise: 10 * 1_000`.
  - `rounds per order`: one fee order of 33_333 paise on Starter → its fee is 333.
  - `upgrade mid-month uses the new included count from that moment`:
    - Starter covers orders 1–60; Growth starts before order 61. There are 250 orders of ₹1,000.
    - Starter line: 10 orders, 10_000 paise.
    - Growth line: 50 orders (201–250), 50 × 750 = 37_500 paise.
  - `scale never charges`: 3,000 orders on Scale → `lines: []`, `feePaise: 0`, `ordersCounted: 3000`.
  - `billable carries under ₹100`:
    - `billable(4_000, 5_000)` → `{ bill: false, totalPaise: 9_000 }`
    - `billable(4_000, 6_000)` → `{ bill: true, totalPaise: 10_000 }`
    - `billable(0, 6_000)` → `{ bill: false, totalPaise: 6_000 }`

- [ ] **Step 2: Run to fail.** Run `bun run --cwd packages/core vitest run src/billing/usage-fee.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `monthFee` and `billable`** in `usage-fee.ts`.

- [ ] **Step 4: Run to pass.** Expected: PASS.

- [ ] **Step 5: Commit** with the message `feat(billing): per-order fee calculation`.

### Task 4: Usage bill table and the month's inputs

**Files:**
- Modify: `packages/db/src/billing-schema.ts` (add `usageBill`; add `fairUseNoticeMonth` to `storePlan`)
- Create: `packages/db/drizzle/0179_usage_bill.sql` (generated, then hand-extended)
- Create: `packages/core/src/billing/usage-fee-service.ts`
- Test: `packages/core/src/billing/usage-fee-service.test.ts` (DB, same setup as `billing.test.ts`)

**Interfaces:**
- Consumes: `monthFee`, `FeeOrder`, `PaidPeriod` (Task 3).
- Produces:
  - **`usageBill` table:**
    - `id`, `storeId`
    - `month` text `YYYY-MM`
    - `ordersCounted`, `feeOrders`, `feePaise`, `carriedInPaise`, `totalPaise` (int)
    - `lines` jsonb `FeeLine[]`
    - `salesOrderId` uuid null, `salesOrderNumber` int null, `mergedIntoSalesOrderId` uuid null
    - `status` text in `('carried','due','merged','paid','cancelled')`
    - `paidAt`, `createdAt`
    - unique `(store_id, month)`, unique `sales_order_id`, index `(store_id, created_at)`
  - **`storePlan.fairUseNoticeMonth`:** text null.
  - **SQL functions** (SECURITY DEFINER, `REVOKE … FROM PUBLIC`, `GRANT EXECUTE … TO app`, as in 0123):
    - `usage_bill_store(sales_order uuid) RETURNS uuid`: matches `sales_order_id` or `merged_into_sales_order_id`.
    - `stores_with_paid_period(from timestamptz, to timestamptz) RETURNS SETOF uuid`: distinct `store_id` from `plan_payment` where `status = 'paid' and period_start < to and period_end > from`.
  - **Service functions:**
    - `loadMonthFeeInputs(tx: StoreTx, storeId: string, month: string): Promise<{ orders: FeeOrder[]; periods: PaidPeriod[] }>`. Orders are filtered as in Global Constraints and placed within the month. Periods are paid `plan_payment` rows overlapping the month.
    - `feeEstimate(tx: StoreTx, storeId: string, now?: Date): Promise<MonthFee & { carriedInPaise: number; month: string }>`. It covers the current month so far; `carriedInPaise` is the latest `carried` row's `totalPaise`, or 0.
    - `previousMonth(month: string): string`
    - `monthOf(at: Date): string`, which is `dayKey(at).slice(0, 7)`.

- [ ] **Step 1: Write the failing DB tests.**
  - `loadMonthFeeInputs excludes drafts, cancelled, test and fully refunded orders but keeps part refunds and COD`:
    - Seed one order of each kind in October.
    - Expect the ids of the counted ones only: open, partially_refunded and COD.
  - `loadMonthFeeInputs returns only paid periods overlapping the month`: seed a paid Sept–Oct bill, a due bill and a cancelled bill. Expect one period.
  - `feeEstimate reports this month so far and the carried amount`.

- [ ] **Step 2: Run to fail.** Run `bun run --cwd packages/core vitest run src/billing/usage-fee-service.test.ts`. Expected: FAIL.

- [ ] **Step 3: Add the schema, generate the migration and extend it.**
  - Run `bun run db:generate`, then rename the output to `0179_usage_bill.sql`.
  - Append `SELECT apply_store_rls();` and the two functions.
  - Run `bun run db:migrate` against the local DB.

- [ ] **Step 4: Implement the service functions** in `usage-fee-service.ts`.

- [ ] **Step 5: Run to pass.** Expected: PASS.

- [ ] **Step 6: Commit** with the message `feat(billing): usage bill table and monthly fee inputs`.

### Task 5: Monthly usage billing in the sweep

**Files:**
- Modify: `packages/core/src/billing/service.ts`. `placeSalesOrder` takes lines. Add `runUsageBilling`, `markUsageBillPaid` and `cancelUsageBill`.
- Modify: `packages/core/src/billing/emails.ts`. `PlanBillEmail.kind` gains `'usage'`.
- Modify: `packages/core/src/billing/app-service.ts`, `credits-service.ts`. These callers move to the new `placeSalesOrder` input.
- Modify: `packages/core/src/outbox/relay.ts:145-163`. Call `markUsageBillPaid` and `cancelUsageBill` next to the plan calls.
- Modify: `apps/worker/src/billing.ts`. Call `runUsageBilling` after `runBillingSweep`, and log when anything is billed.
- Modify: `packages/core/src/index.ts` exports.
- Test: `packages/core/src/billing/usage-billing.test.ts`

**Interfaces:**
- Consumes: Task 4 (`loadMonthFeeInputs`, `usageBill`, `stores_with_paid_period`, `previousMonth`, `monthOf`) and Task 3 (`monthFee`, `billable`).
- Produces:
  - `placeSalesOrder(db, env, storeId, input: { lines: { sku: string; unitPricePaise?: number }[]; note: (buyer: string) => string })`. Each line is quantity 1; `unitPricePaise` overrides the variant price through the draft's existing `unitPricePaise`. The old `{ sku }` callers pass `lines: [{ sku }]`.
  - `usageFeeSku(plan: PlanId | 'carried'): string` gives `usage-fee-starter`, `usage-fee-growth`, `usage-fee-pro` or `usage-fee-carried`.
  - `runUsageBilling(db: Db, env: BillingEnv, now?: Date): Promise<{ stores: number; billed: number; carried: number }>`
  - `markUsageBillPaid(db: Db, salesOrderId: string, now?: Date): Promise<{ storeId: string } | null>`
  - `cancelUsageBill(db: Db, salesOrderId: string): Promise<void>`

How `runUsageBilling` works:
- It bills `previousMonth(monthOf(now))`.
- It loops over `stores_with_paid_period(start of that month, start of this month)`, so a store with no paid period never shows up.
- It skips a store that already has a `usage_bill` row for that month. That makes it idempotent, and the hourly sweep can call it every run.
- The carried-in amount is the store's `carried` row for the month before. Mark that row `merged` when this month's row is written.
- Call `billable` on the fee and the carried-in amount:
  - `bill: false` → insert a `carried` row (also when the total is 0, so the month is closed).
  - `bill: true` → `placeSalesOrder` with one line per `FeeLine` plus a `carried` line when the carry is above 0, insert a `due` row, and send `sendPlanBillEmail` kind `'usage'`.
  - `BillingNotReady` → skip the store without writing a row, so the next run tries again.
- The note reads: `${brand} per-order fees ${month} for ${buyer}, store ${storeId}`.
- `cancelUsageBill` changes only a `due` row to `cancelled`. A `merged` row is left alone (Review Focus 5).

- [ ] **Step 1: Write the failing DB tests.**
  - The sales store is seeded with a gateway and the usage-fee variants. Reuse the sales-store seed helper from `apps.test.ts` if one exists. Otherwise add `seedSalesStore()` to the test file.
  - `bills last month on the first run of a month and not again`:
    - A Starter store with a paid October period and 60 orders of ₹2,000.
    - Run at `2026-11-01T00:30+05:30` → one `due` row with `feeOrders: 10` and `totalPaise: 20_000`.
    - Run again → still one row, and `billed: 0`.
  - `leaves out an order refunded in full before the bill is made`: a fee order set to `paymentStatus: 'refunded'` before the run → `feeOrders` drops by 1.
  - `never bills a store that never paid`: a trial store with 400 orders → no rows, `stores: 0`.
  - `carries under ₹100 and bills it next month`:
    - October gives a ₹60 fee → a `carried` row.
    - November gives a ₹50 fee → a `due` row with `carriedInPaise: 6_000` and `totalPaise: 11_000`, and the October row becomes `merged`.
  - `pays and cancels by sales order`:
    - `markUsageBillPaid` → `paid` with `paidAt` set.
    - `cancelUsageBill` on a `due` row → `cancelled`.
    - Neither touches `storePlan.status`.

- [ ] **Step 2: Run to fail.** Run `bun run --cwd packages/core vitest run src/billing/usage-billing.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement it.** Build what is described above, and move the existing callers to the new `placeSalesOrder` input.

- [ ] **Step 4: Run to pass,** together with `src/billing/billing.test.ts` and `src/billing/apps.test.ts`. Expected: PASS.

- [ ] **Step 5: Commit** with the message `feat(billing): monthly per-order fee bills`.

### Task 6: Unpaid usage bills ride on the next plan bill

**Files:**
- Modify: `packages/core/src/billing/service.ts` (`createPlanBill`, `markPlanBillPaid`)
- Test: add to `packages/core/src/billing/usage-billing.test.ts`

**Interfaces:**
- Consumes: `usageBill`, `usageFeeSku('carried')`, `cancelOrder` from `packages/core/src/order/status.ts`.
- Produces: no new exports. This changes how `createPlanBill` and `markPlanBillPaid` behave.

Behaviour:
- `createPlanBill` reads the store's `due` usage bills.
  - When there are any, it adds one `{ sku: usageFeeSku('carried'), unitPricePaise: sum }` line to the plan bill's `placeSalesOrder` call.
  - After the plan order is placed, each usage bill's row is set to `merged` with `mergedIntoSalesOrderId` = the plan order id. Its old sales order is then cancelled on the sales store with `cancelOrder(ctx, id, { notifyCustomer: false })`.
- `markPlanBillPaid` also sets every `merged` usage bill whose `mergedIntoSalesOrderId` matches to `paid`, with `paidAt` set.
- AutoPay stores don't get plan bills from the sweep, so their usage bills stay `due` with the banner (spec decision). Pin this with a test.

- [ ] **Step 1: Write the failing tests.**
  - `adds an unpaid usage bill to the renewal and settles it when paid`:
    - A due usage bill of 20_000 paise, then the sweep makes a renewal bill.
    - The plan order total includes 20_000 paise (plus GST as the sales store charges).
    - The usage row becomes `merged`, its old sales order is `cancelled`, and the usage row is still `merged` after the cancel hook runs.
    - `markPlanBillPaid(planOrderId)` sets the usage row to `paid`.
  - `an AutoPay store's usage bill stays due and the plan keeps its status`.

- [ ] **Step 2: Run to fail.** Same command as Task 5. Expected: FAIL.

- [ ] **Step 3: Implement it** in `service.ts`.

- [ ] **Step 4: Run to pass.** Expected: PASS.

- [ ] **Step 5: Commit** with the message `feat(billing): unpaid fee bills join the next plan bill`.

### Task 7: Fair-use visits

**Files:**
- Modify: `apps/storefront/src/app/api/beacon/route.ts:~133`. Don't record a session when `isBotUserAgent(request.headers.get('user-agent'))`.
- Create: `packages/core/src/billing/fair-use.ts`
- Modify: `packages/core/src/billing/emails.ts`. Kind `'fair_use'`; send a copy to `siteConfig.contact.supportEmail` so Koomerce can reach out.
- Modify: `apps/worker/src/billing.ts`. Call `runFairUseCheck` after `runUsageBilling`.
- Test: `packages/core/src/billing/fair-use.test.ts`

**Interfaces:**
- Consumes: `PLANS[plan].visitsPerMonth` (Task 1), `marketingSession`, `stores_with_paid_period` (Task 4), `previousMonth`, `monthOf`.
- Produces:
  - `monthVisits(tx: StoreTx, month: string): Promise<number>` counts `marketing_session` rows started in that IST month.
  - `overFairUse(plan: PlanId, lastTwo: [number, number]): boolean` is false when `visitsPerMonth` is null, otherwise true when both months are over the limit.
  - `runFairUseCheck(db: Db, now?: Date): Promise<{ checked: number; noticed: number }>`
    - It checks the two finished months against the current plan.
    - On a breach where `fairUseNoticeMonth !== lastMonth`, it sets `fairUseNoticeMonth = lastMonth` and sends the email.
    - It never changes status or limits.

- [ ] **Step 1: Write the failing tests.**
  - `overFairUse`:
    - `('starter', [25_001, 30_000])` → true
    - `('starter', [25_001, 20_000])` → false
    - `('scale', [9e9, 9e9])` → false
  - DB:
    - `notices a Starter store over 25,000 visits two months running, once`: seed sessions, run twice → `noticed: 1`, then `0`.
    - `ignores a store over for one month only`.
  - Beacon: if `apps/storefront` has a route test harness, add `a bot user agent starts no session`. If not, cover `isBotUserAgent('Googlebot/2.1')` in `packages/core/src/marketing` tests.

- [ ] **Step 2: Run to fail.** Run `bun run --cwd packages/core vitest run src/billing/fair-use.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement it.**
  - The comment on `monthVisits` should say sessions only count shoppers who accepted analytics, so this undercounts. That's acceptable for a soft limit.

- [ ] **Step 4: Run to pass.** Expected: PASS.

- [ ] **Step 5: Commit** with the message `feat(billing): fair-use visit notices; bots start no session`.

### Task 8: Billing API and admin Plan & billing

**Files:**
- Modify: `packages/api/src/routers/billing.ts`
  - `view` returns `fees` (`feeEstimate`), `usageBills` (the last 12 rows with their pay URL) and `fairUseNotice: boolean` (`fairUseNoticeMonth === previousMonth(monthOf(now))`).
  - `usage` adds `feePercent` and `nextOrderFeeNote`.
  - Add `usageBillCsv` (input `{ id }`). It returns the CSV of the orders that bill covered: order number, placed at, total, plan, fee.
- Modify: `apps/admin/src/components/billing/current-plan-card.tsx`. Add this month's line: orders so far / included, fee orders, estimated fee (with the carried-in amount when above 0).
- Create: `apps/admin/src/components/billing/usage-bills-card.tsx`. Same layout as `bills-card.tsx`: month, fee orders, amount, status, Pay/Invoice link, CSV download.
- Modify: `apps/admin/src/components/billing/compare-plans-dialog.tsx`. Show four plans with fee rate, orders and visits rows, plus an Own it card whose "Talk to us" button goes to `${siteConfig.urls.site}/contact`.
- Modify: `apps/admin/src/components/billing/billing-page.tsx`. Show the fair-use notice banner and an unpaid-fee banner (any `due` usage bill), and render `UsageBillsCard`.
- Modify: `apps/admin/src/components/billing/autopay-row.tsx`. Add the note: per-order fees are always a pay link.
- Modify: `apps/admin/src/components/layout/sidebar-usage-card.tsx` and its caller in `admin-sidebar.tsx`.
  - At ≥ 80% of the included orders, show a warning line.
  - At ≥ 100%, show `copy.usage.feeAfter(percent)` ("Each further order: 1% of its total").
  - Scale shows neither.
- Modify: `apps/admin/src/data/billing.ts`, `apps/admin/src/data/hi/billing.ts`, `apps/admin/src/data/navigation.ts`, `apps/admin/src/data/hi/navigation.ts` (all new copy, English and Hindi).
- Test: `packages/api/test/billing.test.ts` (add to it, or create it in the style of `packages/api/test/purchasing.test.ts`)

**Interfaces:**
- Consumes: `feeEstimate`, `usageBill`, `PLANS[*].feeBasisPoints`, `PLANS[*].visitsPerMonth`.
- Produces: the `billing.view` additions `fees: { month: string; ordersCounted: number; feeOrders: number; feePaise: number; carriedInPaise: number; lines: FeeLine[] }`, `usageBills: { id; month; feeOrders; totalPaise; status; url: string | null }[]`, and `fairUseNotice: boolean`.

- [ ] **Step 1: Write the failing API tests.**
  - `view returns this month's fee estimate and usage bills`.
  - `usageBillCsv lists the fee orders of that month only, for the signed-in store` (another store's id → NOT_FOUND).

- [ ] **Step 2: Run to fail.** Run `bun run --cwd packages/api vitest run test/billing.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the router changes.**

- [ ] **Step 4: Run to pass.** Expected: PASS.

- [ ] **Step 5: Build the admin UI and copy,** following `docs/design/admin-frames.md` and `docs/conventions.md`.

- [ ] **Step 6: Check the page in the running admin.**
  - Use the kove browser: `kove browser open` on the admin, then go to Settings → Plan & billing.
  - Screenshot a Starter store over 50 orders (estimate shown, sidebar warning) and the Compare dialog (four plans plus Own it).
  - Switch to Hindi and check for no missing keys.

- [ ] **Step 7: Commit** with the message `feat(admin): per-order fee estimate, usage bills, Scale and Own it on Plan & billing`.

### Task 9: Marketing site pricing and claims

**Files:**
- Modify: `apps/www/src/data/pricing.ts`
  - Four plans, with the fee and visits per plan.
  - An Own it band (₹49,999 + ₹3,000/mo care, ₹7,500 setup, "Talk to us").
  - Compare rows: fee after included orders, orders, fair-use visits.
  - The FAQ is rewritten:
    - how the fee is counted: per IST month, on the order total, cancelled or fully refunded orders excluded, COD counts, trial orders free;
    - when it's billed: on the 1st, carried forward under ₹100;
    - what fair use means;
    - "0% on Scale; on other plans, a small fee only after your included orders".
  - Remove the ₹49/100 overage text.
- Modify: `apps/www/src/lib/pricing-math.ts`. Add `monthlyCost(plan, orders, avgOrderInr): { planInr: number; feeInr: number; totalInr: number }`, with the fee on `max(0, orders - included) × avg × bp`. Add `bestPlan(orders, avgOrderInr): PlanId` (the cheapest total).
- Modify: `apps/www/src/components/pricing/orders-calculator.tsx`, `savings-card.tsx`, `plan-card.tsx`, `compare-table.tsx`, `pricing-explorer.tsx`, `apps/www/src/components/home/home-pricing.tsx`. These render four plans, use the calculator's average order value input, and add the Own it band.
- Modify: `apps/www/src/app/page.tsx`, `apps/www/src/app/pricing/page.tsx`, `apps/www/src/data/solutions.ts`, `apps/www/src/data/home.ts`. Change every "0% transaction fee" claim. Find them with `grep -rni "transaction fee\|per 100 orders\|1,499\|14,990" apps/www/src`.
- Modify: `apps/www/src/data/legal/terms.ts` "Plans and billing". Add the per-order fee (how it's counted and billed, carry-forward, added to the next plan bill if unpaid) and fair-use visits (two months over → we contact you; nothing is blocked).
- Test: `apps/www/src/lib/pricing-math.test.ts` (add to it, or create it)

**Interfaces:**
- Consumes: `siteConfig.plans` (Task 1: `feePercent`, `visitsPerMonth`).
- Produces: `monthlyCost`, `bestPlan`.

- [ ] **Step 1: Write the failing tests.**
  - `monthlyCost('starter', 40, 800)` → `{ planInr: 499, feeInr: 0, totalInr: 499 }` (the anti-goal: a 40-order seller pays ₹499).
  - `monthlyCost('growth', 300, 1000)` → `feeInr: 750`.
  - `monthlyCost('scale', 5000, 1000).feeInr` → 0.
  - `bestPlan(2600, 1000)` → `'scale'`. Pro: 4,999 + 2,100 × 5 = 15,499 > 14,999.

- [ ] **Step 2: Run to fail.** Run `bun run --cwd apps/www vitest run src/lib/pricing-math.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the math, then the data and components.**

- [ ] **Step 4: Run to pass.** Then check `/pricing` and `/` in the kove browser at desktop and phone width.

- [ ] **Step 5: Commit** with the message `feat(www): new pricing, per-order fee, Scale and Own it`.

### Task 10: Docs, memory bank, handoff and sales-store checklist

**Files:**
- Modify: `apps/docs/content/merchant-guide/settings/plan-and-billing.mdx`. Cover plans, the fee, usage bills, carry-forward, AutoPay and fees, and fair use.
- Modify: any developer-docs page that lists plans. Find them with `grep -rln "Growth\|PLANS" apps/docs/content/developer-docs`.
- Check `apps/docs/content/merchant-guide/products/products-collections.mdx` and fix it if it repeats plan limits.
- Rewrite `memory-bank/pricing.md` to the spec: India table, fee rules, Scale, Own it, regional table, profit check.
- Create: `docs/handoff/changes/2026-10-28-pricing-revamp.md`. Cover what changed, the migrations 0178 and 0179, and the **sales-store setup the owner must do before release**:
  - Growth variants priced ₹1,999 / ₹19,990.
  - New product "Scale" with SKUs `plan-scale-month` ₹14,999 and `plan-scale-year` ₹1,49,990.
  - Product "Per-order fees" with SKUs `usage-fee-starter`, `usage-fee-growth`, `usage-fee-pro` and `usage-fee-carried` (any price; the bill sets it), taxed at 18% like the plans.
  - Check the Pro variants still read ₹4,999 / ₹49,990.

- [ ] **Step 1: Write the docs and memory-bank changes.** Check them with `bun run --cwd apps/docs build`. Expected: PASS.

- [ ] **Step 2: Final verification** (owner rule: once, at the end).
  - Run `bun run lint`, `bun run typecheck` and `bun run test`.
  - Run `git checkout HEAD -- packages/ticket/src/__generated__/` if that folder exists, then `bun run --cwd apps/admin build` and `bun run --cwd apps/www build`.
  - Expected: all PASS. Fix and rerun on failure.

- [ ] **Step 3: Commit** with the message `docs(pricing): merchant guide, memory bank and handoff for the pricing revamp`.

- [ ] **Step 4: Open the PR** into `dev` with `gh pr create --base dev`. The body summarises the plan, lists the sales-store checklist, and ends with the attribution line. Don't release to `main`; the owner batches releases.
