/** SOURCE OF TRUTH: loyalty v2 test fixtures — WHAT: a seeded store with a product and customers, delivered orders, and shortcuts to run a core function in the store under RLS / WHY: the v2 suites share one seed so each test reads as the rule it checks */
import {
  createDb,
  customer,
  customerSession,
  order,
  orderLine,
  payment,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import type { StoreContext } from '../context'
import { defaultLoyaltySettings, type LoyaltySettings, LoyaltySettingsSchema } from './settings'

export const owner = createDb(process.env.DATABASE_URL_OWNER as string)
export const app = createDb(process.env.DATABASE_URL as string)

export const DAY = 24 * 60 * 60 * 1000
export const T0 = new Date('2026-11-23T06:00:00Z')
export const at = (days: number) => new Date(T0.getTime() + days * DAY)

/** v1 defaults with `over` on top (parsed, so nested defaults fill in). */
export const settingsWith = (over: Partial<LoyaltySettings> = {}): LoyaltySettings =>
  LoyaltySettingsSchema.parse({ ...defaultLoyaltySettings, ...over })

export type Seed = {
  storeId: string
  productId: string
  variantId: string
  customerId: string
  otherId: string
}

let seq = 0

/** A store with one product (₹2,500) and two customers: Asha and Ravi. */
export async function seed(): Promise<Seed> {
  seq += 1
  const [s] = await owner
    .insert(store)
    .values({ slug: `w${seq}`, name: 'Waimers' })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Maboroshi pad', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'XL', pricePaise: 250_000 })
    .returning()
  const [a] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  const [b] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'ravi@example.com', name: 'Ravi' })
    .returning()
  if (!v || !a || !b) throw new Error('seed')
  return { storeId: s.id, productId: p.id, variantId: v.id, customerId: a.id, otherId: b.id }
}

/** Another customer in the store. */
export async function addCustomer(
  t: Seed,
  values: Partial<typeof customer.$inferInsert> & { email: string },
): Promise<string> {
  const [c] = await owner
    .insert(customer)
    .values({ storeId: t.storeId, name: 'Friend', ...values })
    .returning()
  if (!c) throw new Error('seed')
  return c.id
}

/** The customer has signed in to the storefront once. */
export async function signIn(t: Seed, customerId: string) {
  await owner.insert(customerSession).values({
    storeId: t.storeId,
    customerId,
    tokenHash: `tok_${customerId}_${Math.random()}`,
    expiresAt: new Date(T0.getTime() + 30 * DAY),
  })
}

let nextNumber = 5001

/** A delivered cash on delivery order of `goodsPaise` (one line), with its COD payment row. */
export async function deliveredOrder(
  t: Seed,
  goodsPaise: number,
  extra: Partial<typeof order.$inferInsert> = {},
) {
  const [o] = await owner
    .insert(order)
    .values({
      storeId: t.storeId,
      number: nextNumber++,
      status: 'open',
      subtotalPaise: goodsPaise,
      shippingPaise: 4_900,
      totalPaise: goodsPaise + 4_900,
      customerId: t.customerId,
      email: 'asha@example.com',
      paymentMethod: 'cod',
      paymentStatus: 'paid',
      fulfillmentStatus: 'delivered',
      placedAt: T0,
      ...extra,
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(orderLine).values({
    storeId: t.storeId,
    orderId: o.id,
    variantId: t.variantId,
    title: 'Maboroshi pad',
    quantity: 1,
    unitPricePaise: goodsPaise,
  })
  const [pay] = await owner
    .insert(payment)
    .values({
      storeId: t.storeId,
      orderId: o.id,
      provider: 'cod',
      providerRef: `cod_${o.number}`,
      status: 'captured',
      amountPaise: goodsPaise + 4_900,
    })
    .returning()
  if (!pay) throw new Error('seed')
  return { orderId: o.id, paymentId: pay.id, number: o.number }
}

/** Runs `fn` in the store under RLS. */
export const run = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>): Promise<T> =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))
