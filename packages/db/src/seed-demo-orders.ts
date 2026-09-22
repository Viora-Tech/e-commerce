import { and, eq, inArray, sql } from 'drizzle-orm'
import { createDb } from './client'
import {
  address,
  customer,
  inventoryLevel,
  order,
  orderLine,
  payment,
  product,
  store,
  variant,
} from './schema'

/**
 * Demo orders so the dashboard has shape in development: ~60 orders over the
 * last 14 days across eight states, mixed statuses and payment methods, real
 * variants from the seeded catalogue. Every row is tagged `demo` so
 * `--clean` can remove exactly what this script created.
 */

const DEMO_TAG = 'demo'

const CUSTOMERS = [
  ['Aarav Mehta', 'aarav.mehta', 'Mumbai', 'MH', '400053'],
  ['Ishita Rao', 'ishita.rao', 'Bengaluru', 'KA', '560034'],
  ['Rohan Iyer', 'rohan.iyer', 'Chennai', 'TN', '600041'],
  ['Sneha Kulkarni', 'sneha.k', 'Pune', 'MH', '411045'],
  ['Kabir Singh', 'kabir.singh', 'Gurugram', 'HR', '122002'],
  ['Ananya Bose', 'ananya.bose', 'Kolkata', 'WB', '700091'],
  ['Devansh Patel', 'devansh.p', 'Ahmedabad', 'GJ', '380015'],
  ['Meera Nair', 'meera.nair', 'Kochi', 'KL', '682036'],
  ['Arjun Reddy', 'arjun.reddy', 'Hyderabad', 'TS', '500081'],
  ['Priya Sharma', 'priya.sharma', 'Jaipur', 'RJ', '302017'],
  ['Vihaan Malhotra', 'vihaan.m', 'New Delhi', 'DL', '110017'],
  ['Tanvi Deshmukh', 'tanvi.d', 'Nagpur', 'MH', '440010'],
  ['Siddharth Menon', 'sid.menon', 'Thiruvananthapuram', 'KL', '695011'],
  ['Riya Agarwal', 'riya.agarwal', 'Noida', 'UP', '201301'],
  ['Nikhil Verma', 'nikhil.verma', 'Lucknow', 'UP', '226010'],
  ['Zara Khan', 'zara.khan', 'Bhopal', 'MP', '462016'],
] as const

const STREETS = [
  '14, Lotus Apartments, Link Road',
  '2nd Floor, 88 Brigade Road',
  'Flat 7B, Sea Breeze Towers',
  'Plot 21, Sector 45',
  '5, Ballygunge Place',
  'B-304, Palm Meadows',
  '11, Marine Drive Lane',
  'House 9, Jubilee Hills',
] as const

type Status = 'placed' | 'paid' | 'fulfilled' | 'delivered' | 'cancelled'
const STATUS_MIX: Status[] = [
  'delivered',
  'delivered',
  'delivered',
  'fulfilled',
  'fulfilled',
  'paid',
  'paid',
  'placed',
  'cancelled',
]
const METHOD_MIX = ['razorpay', 'razorpay', 'cod', 'cod', 'manual'] as const

/** Deterministic pseudo-random so reruns produce the same shape. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

function pick<T>(arr: readonly T[], r: () => number): T {
  return arr[Math.floor(r() * arr.length)] as T
}

/** Orders cluster in the evening; weekends are busier, which gives the weekly chart a curve. */
function placedAt(dayOffset: number, r: () => number): Date {
  const d = new Date()
  d.setDate(d.getDate() - dayOffset)
  d.setHours(9 + Math.floor(r() * 13), Math.floor(r() * 60), Math.floor(r() * 60), 0)
  return d
}

export async function seedDemoOrders(ownerUrl: string, opts: { clean?: boolean } = {}) {
  const db = createDb(ownerUrl)
  try {
    const [s] = await db.select().from(store).where(eq(store.slug, 'waimers'))
    if (!s) throw new Error('seed the store first (bun run db:seed)')
    const storeId = s.id

    // Remove anything tagged demo (orders cascade by hand: payments, lines, then orders, addresses, customers).
    const demoOrders = await db
      .select({ id: order.id, addressId: order.shippingAddressId, customerId: order.customerId })
      .from(order)
      .where(and(eq(order.storeId, storeId), sql`${order.tags} @> ARRAY[${DEMO_TAG}]::text[]`))
    if (demoOrders.length > 0) {
      const ids = demoOrders.map((o) => o.id)
      await db.delete(payment).where(inArray(payment.orderId, ids))
      await db.delete(orderLine).where(inArray(orderLine.orderId, ids))
      await db.delete(order).where(inArray(order.id, ids))
      const addrIds = demoOrders.map((o) => o.addressId).filter((x): x is string => !!x)
      if (addrIds.length) await db.delete(address).where(inArray(address.id, addrIds))
      await db
        .delete(customer)
        .where(
          and(eq(customer.storeId, storeId), sql`${customer.tags} @> ARRAY[${DEMO_TAG}]::text[]`),
        )
      console.log(`demo: removed ${ids.length} orders`)
    }
    if (opts.clean) return

    const variants = await db
      .select({
        id: variant.id,
        title: variant.title,
        pricePaise: variant.pricePaise,
        productTitle: product.title,
      })
      .from(variant)
      .innerJoin(product, eq(product.id, variant.productId))
      .innerJoin(inventoryLevel, eq(inventoryLevel.variantId, variant.id))
      .where(
        and(
          eq(variant.storeId, storeId),
          sql`${inventoryLevel.onHand} - ${inventoryLevel.reserved} > 0`,
        ),
      )
    if (variants.length === 0) throw new Error('no in-stock variants to order')

    const r = rng(20260921)
    const customerIds = new Map<string, string>()
    for (const [name, handle, city, stateCode, pincode] of CUSTOMERS) {
      const email = `${handle}@example.in`
      const [c] = await db
        .insert(customer)
        .values({
          storeId,
          email,
          name,
          phone: `9${Math.floor(100000000 + r() * 899999999)}`,
          tags: [DEMO_TAG],
          defaultAddress: {
            name,
            line1: pick(STREETS, r),
            city,
            stateCode,
            pincode,
            country: 'IN',
          },
        })
        .returning({ id: customer.id })
      if (c) customerIds.set(email, c.id)
    }

    const [counter] = await db
      .select({ next: store.nextOrderNumber })
      .from(store)
      .where(eq(store.id, storeId))
    let number = counter?.next ?? 1
    const total = 60
    for (let i = 0; i < total; i++) {
      const c = pick(CUSTOMERS, r)
      const [name, handle, city, stateCode, pincode] = c
      const email = `${handle}@example.in`
      const dayOffset = Math.floor(r() * 14)
      const at = placedAt(dayOffset, r)
      const status = dayOffset === 0 ? pick(['placed', 'paid'] as const, r) : pick(STATUS_MIX, r)
      const method = pick(METHOD_MIX, r)
      const lineCount = r() < 0.7 ? 1 : 2
      const lines = Array.from({ length: lineCount }, () => ({
        v: pick(variants, r),
        qty: r() < 0.85 ? 1 : 2,
      }))
      const subtotal = lines.reduce((sum, l) => sum + l.v.pricePaise * l.qty, 0)
      const adjustment =
        method === 'cod' ? 4900 : method === 'manual' ? -Math.round(subtotal * 0.03) : 0

      const [addr] = await db
        .insert(address)
        .values({
          storeId,
          name,
          line1: pick(STREETS, r),
          city,
          stateCode,
          pincode,
          phone: `9${Math.floor(100000000 + r() * 899999999)}`,
        })
        .returning({ id: address.id })
      if (!addr) continue
      const [o] = await db
        .insert(order)
        .values({
          storeId,
          number: number++,
          customerId: customerIds.get(email) ?? null,
          email,
          phone: null,
          shippingAddressId: addr.id,
          paymentMethod: method,
          status,
          subtotalPaise: subtotal,
          paymentAdjustmentPaise: adjustment,
          paymentAdjustmentLabel:
            method === 'cod' ? 'COD handling fee' : method === 'manual' ? 'UPI discount' : null,
          totalPaise: subtotal + adjustment,
          tags: [DEMO_TAG],
          placedAt: at,
        })
        .returning({ id: order.id })
      if (!o) continue
      await db.insert(orderLine).values(
        lines.map((l) => ({
          storeId,
          orderId: o.id,
          variantId: l.v.id,
          title: l.v.productTitle,
          variantTitle: l.v.title,
          quantity: l.qty,
          unitPricePaise: l.v.pricePaise,
        })),
      )
      const captured = status !== 'placed' && status !== 'cancelled'
      await db.insert(payment).values({
        storeId,
        orderId: o.id,
        provider: method,
        providerRef: `demo_${o.id}`,
        status: status === 'cancelled' ? 'failed' : captured ? 'captured' : 'pending',
        amountPaise: subtotal + adjustment,
      })
    }
    await db.update(store).set({ nextOrderNumber: number }).where(eq(store.id, storeId))
    console.log(`demo: created ${total} orders for ${CUSTOMERS.length} customers`)
  } finally {
    await db.$client.end()
  }
}

if ((import.meta as { main?: boolean }).main) {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  await seedDemoOrders(url, { clean: process.argv.includes('--clean') })
}
