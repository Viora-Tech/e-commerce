/** SOURCE OF TRUTH: per-order fee test seeds — WHAT: stores, orders and paid plan periods written
 * straight to the database / WHY: the fee, usage-bill and fair-use suites share one setup */

import { randomUUID } from 'node:crypto'
import {
  type Db,
  order,
  planPayment,
  product,
  type StorePlanId,
  store,
  storePlan,
  variant,
} from '@commerce/db'

export async function seedStore(owner: Db, slug: string): Promise<string> {
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Store ${slug}`, contactEmail: `${slug}@x.in` })
    .returning()
  if (!s) throw new Error('seed store')
  return s.id
}

/** A paid plan period `[start, end)`, as a paid plan bill leaves it, and the store on that plan. */
export async function seedPaidPeriod(
  owner: Db,
  storeId: string,
  plan: StorePlanId,
  start: Date,
  end: Date,
): Promise<void> {
  await owner.insert(planPayment).values({
    storeId,
    plan,
    interval: 'month',
    salesOrderId: randomUUID(),
    salesOrderNumber: 1,
    amountPaise: 1,
    periodStart: start,
    periodEnd: end,
    status: 'paid',
    paidAt: start,
  })
  await owner
    .insert(storePlan)
    .values({ storeId, plan, status: 'active', periodStart: start, periodEnd: end })
    .onConflictDoUpdate({
      target: storePlan.storeId,
      set: { plan, status: 'active', periodStart: start, periodEnd: end },
    })
}

type SeedOrder = {
  placedAt: Date
  totalPaise?: number
  status?: 'draft' | 'open' | 'cancelled'
  paymentStatus?: 'unpaid' | 'paid' | 'partially_refunded' | 'refunded'
  paymentMethod?: string
  isTest?: boolean
}

let nextNumber = 1000

/** Orders on `storeId`; returns their ids in the order given. */
export async function seedOrders(owner: Db, storeId: string, list: SeedOrder[]): Promise<string[]> {
  if (list.length === 0) return []
  const rows = await owner
    .insert(order)
    .values(
      list.map((o) => ({
        storeId,
        number: nextNumber++,
        email: 'buyer@x.in',
        subtotalPaise: o.totalPaise ?? 1_00_000,
        totalPaise: o.totalPaise ?? 1_00_000,
        status: o.status ?? 'open',
        paymentStatus: o.paymentStatus ?? 'paid',
        paymentMethod: o.paymentMethod ?? 'razorpay',
        isTest: o.isTest ?? false,
        placedAt: o.placedAt,
      })),
    )
    .returning({ id: order.id })
  return rows.map((r) => r.id)
}

/** `n` orders of `totalPaise`, one minute apart from `from`. */
export const ordersFrom = (n: number, from: Date, totalPaise = 1_00_000): SeedOrder[] =>
  Array.from({ length: n }, (_, i) => ({
    placedAt: new Date(from.getTime() + i * 60_000),
    totalPaise,
  }))

/** The SKUs the platform sales store sells for plan, fee and carried bills in these tests. */
const SALES_SKUS: { sku: string; pricePaise: number }[] = [
  { sku: 'plan-starter-month', pricePaise: 49_900 },
  { sku: 'plan-growth-month', pricePaise: 1_99_900 },
  { sku: 'usage-fee-starter', pricePaise: 0 },
  { sku: 'usage-fee-growth', pricePaise: 0 },
  { sku: 'usage-fee-pro', pricePaise: 0 },
  { sku: 'usage-fee-carried', pricePaise: 0 },
]

/** A sales store with Razorpay on and every plan and fee SKU, as the platform runs it. */
export async function seedSalesStore(owner: Db): Promise<string> {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'koomerce-sales', name: 'Koomerce', payments: { enabled: ['razorpay'] } })
    .returning()
  if (!s) throw new Error('seed sales store')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'billing', title: 'Koomerce billing', status: 'active' })
    .returning()
  if (!p) throw new Error('seed sales product')
  await owner.insert(variant).values(
    SALES_SKUS.map((v) => ({
      storeId: s.id,
      productId: p.id,
      title: v.sku,
      sku: v.sku,
      pricePaise: v.pricePaise,
      // A bill ships nothing; the platform's plan products don't track stock.
      trackInventory: false,
    })),
  )
  return s.id
}
