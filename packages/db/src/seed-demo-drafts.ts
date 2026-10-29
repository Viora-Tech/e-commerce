import { and, eq, inArray, sql } from 'drizzle-orm'
import { createDb } from './client'
import {
  address,
  cart,
  cartLine,
  customer,
  inventoryLevel,
  notification,
  order,
  orderLine,
  orderNote,
  product,
  store,
  variant,
} from './schema'
import { primarySellingLevel } from './stock'

/**
 * Demo draft orders and abandoned checkouts, so both screens have something to
 * review in development. Drafts are tagged `demo-draft`; carts are recognised
 * by their `@example.in` demo emails, so `--clean` removes exactly these rows.
 */

const DRAFT_TAG = 'demo-draft'
const DEMO_DOMAIN = '@example.in'

const PEOPLE = [
  ['Aarav Mehta', 'aarav.mehta', 'Mumbai', 'MH', '400053'],
  ['Ishita Rao', 'ishita.rao', 'Bengaluru', 'KA', '560034'],
  ['Rohan Iyer', 'rohan.iyer', 'Chennai', 'TN', '600041'],
  ['Sneha Kulkarni', 'sneha.k', 'Pune', 'MH', '411045'],
  ['Kabir Singh', 'kabir.singh', 'Gurugram', 'HR', '122002'],
  ['Ananya Bose', 'ananya.bose', 'Kolkata', 'WB', '700091'],
  ['Meera Nair', 'meera.nair', 'Kochi', 'KL', '682036'],
  ['Arjun Reddy', 'arjun.reddy', 'Hyderabad', 'TS', '500081'],
  ['Priya Sharma', 'priya.sharma', 'Jaipur', 'RJ', '302017'],
  ['Vihaan Malhotra', 'vihaan.m', 'New Delhi', 'DL', '110017'],
  ['Riya Agarwal', 'riya.agarwal', 'Noida', 'UP', '201301'],
  ['Zara Khan', 'zara.khan', 'Bhopal', 'MP', '462016'],
] as const

const STREETS = [
  '14, Lotus Apartments, Link Road',
  '2nd Floor, 88 Brigade Road',
  'Flat 7B, Sea Breeze Towers',
  'Plot 21, Sector 45',
  'B-304, Palm Meadows',
] as const

const DRAFT_NOTES = [
  'Customer called, wants delivery after 6pm.',
  'Bulk order for a LAN party, confirm stock before invoicing.',
  'Repeat buyer from Instagram, promised the launch price.',
  '',
] as const

const DRAFT_COUNT = 8
const CART_COUNT = 12

/** Deterministic pseudo-random so reruns produce the same shape. */
function rng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 0x100000000
  }
}

const pick = <T>(arr: readonly T[], r: () => number): T => arr[Math.floor(r() * arr.length)] as T

/** Carts spread across the last seven days; every one is older than the abandoned grace period. */
function quietSince(dayOffset: number, r: () => number): Date {
  const d = new Date()
  d.setDate(d.getDate() - dayOffset)
  d.setHours(9 + Math.floor(r() * 12), Math.floor(r() * 60), 0, 0)
  const twoHoursAgo = Date.now() - 2 * 60 * 60_000
  return d.getTime() > twoHoursAgo ? new Date(twoHoursAgo) : d
}

export async function seedDemoDrafts(ownerUrl: string, opts: { clean?: boolean } = {}) {
  const db = createDb(ownerUrl)
  try {
    const [s] = await db.select().from(store).where(eq(store.slug, 'waimers'))
    if (!s) throw new Error('seed the store first (bun run db:seed)')
    const storeId = s.id

    const demoDrafts = await db
      .select({ id: order.id, addressId: order.shippingAddressId })
      .from(order)
      .where(and(eq(order.storeId, storeId), sql`${order.tags} @> ARRAY[${DRAFT_TAG}]::text[]`))
    if (demoDrafts.length > 0) {
      const ids = demoDrafts.map((d) => d.id)
      await db.delete(notification).where(inArray(notification.orderId, ids))
      await db.delete(orderNote).where(inArray(orderNote.orderId, ids))
      await db.delete(orderLine).where(inArray(orderLine.orderId, ids))
      await db.delete(order).where(inArray(order.id, ids))
      const addrIds = demoDrafts.map((d) => d.addressId).filter((x): x is string => !!x)
      if (addrIds.length) await db.delete(address).where(inArray(address.id, addrIds))
      console.log(`demo: removed ${ids.length} drafts`)
    }

    const demoCarts = await db
      .select({ id: cart.id })
      .from(cart)
      .where(and(eq(cart.storeId, storeId), sql`${cart.email} like ${`%${DEMO_DOMAIN}`}`))
    if (demoCarts.length > 0) {
      const ids = demoCarts.map((c) => c.id)
      await db.delete(notification).where(inArray(notification.cartId, ids))
      await db.delete(cartLine).where(inArray(cartLine.cartId, ids))
      await db.delete(cart).where(inArray(cart.id, ids))
      console.log(`demo: removed ${ids.length} carts`)
    }
    if (opts.clean) return

    const rows = await db
      .select({
        id: variant.id,
        title: variant.title,
        pricePaise: variant.pricePaise,
        productTitle: product.title,
      })
      .from(variant)
      .innerJoin(product, eq(product.id, variant.productId))
      .innerJoin(
        inventoryLevel,
        and(eq(inventoryLevel.variantId, variant.id), primarySellingLevel(variant.id)),
      )
      .where(
        and(
          eq(variant.storeId, storeId),
          sql`${inventoryLevel.onHand} - ${inventoryLevel.reserved} > 0`,
        ),
      )
    // A variant without a price (#929) cannot be sold, so it never goes in a demo draft.
    const variants = rows.flatMap((v) =>
      v.pricePaise === null ? [] : [{ ...v, pricePaise: v.pricePaise }],
    )
    if (variants.length === 0) throw new Error('no in-stock, priced variants to draft')

    const r = rng(20260922)
    const customers = await db
      .select({ id: customer.id, email: customer.email, name: customer.name })
      .from(customer)
      .where(eq(customer.storeId, storeId))
    const byEmail = new Map(customers.map((c) => [c.email, c]))

    const [counter] = await db
      .select({ next: store.nextOrderNumber })
      .from(store)
      .where(eq(store.id, storeId))
    let number = counter?.next ?? 1

    for (let i = 0; i < DRAFT_COUNT; i++) {
      const [name, handle, city, stateCode, pincode] = pick(PEOPLE, r)
      const email = `${handle}${DEMO_DOMAIN}`
      /* Two of the eight are quotes with no customer attached yet. */
      const anonymous = i % 4 === 3
      const lineCount = i === DRAFT_COUNT - 1 ? 5 : r() < 0.6 ? 1 : 2
      const lines = Array.from({ length: lineCount }, () => ({
        v: pick(variants, r),
        qty: r() < 0.8 ? 1 : 2,
      }))
      const subtotal = lines.reduce((sum, l) => sum + l.v.pricePaise * l.qty, 0)
      const discount = i % 3 === 0 ? Math.round(subtotal * 0.1) : 0

      const [addr] = anonymous
        ? []
        : await db
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

      const [o] = await db
        .insert(order)
        .values({
          storeId,
          number: number++,
          status: 'draft',
          customerId: anonymous ? null : (byEmail.get(email)?.id ?? null),
          email: anonymous ? null : email,
          phone: null,
          shippingAddressId: addr?.id ?? null,
          paymentMethod: pick(['manual', 'cod', 'razorpay'] as const, r),
          subtotalPaise: subtotal,
          discountPaise: discount,
          discountLabel: discount ? 'Phone order discount' : null,
          shippingPaise: 0,
          totalPaise: subtotal - discount,
          tags: [DRAFT_TAG],
          placedAt: quietSince(Math.floor(r() * 7), r),
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
      const note = pick(DRAFT_NOTES, r)
      if (note) {
        await db.insert(orderNote).values({ storeId, orderId: o.id, body: note, author: 'draft' })
      }
      /* Three of them have already had an invoice emailed. */
      if (i % 3 === 1 && !anonymous) {
        await db.insert(notification).values({
          storeId,
          orderId: o.id,
          channel: 'invoice',
          template: 'draft_invoice',
          to: email,
          status: 'sent',
        })
      }
    }
    await db.update(store).set({ nextOrderNumber: number }).where(eq(store.id, storeId))

    for (let i = 0; i < CART_COUNT; i++) {
      const [name, handle] = pick(PEOPLE, r)
      const email = `${handle}${DEMO_DOMAIN}`
      const at = quietSince(Math.floor(r() * 7), r)
      /* Two came back and bought; three were nudged and have not. */
      const recovered = i < 2
      const nudged = !recovered && i < 5
      const [c] = await db
        .insert(cart)
        .values({
          storeId,
          status: recovered ? 'converted' : 'open',
          customerId: byEmail.get(email)?.id ?? null,
          email,
          phone: `9${Math.floor(100000000 + r() * 899999999)}`,
          customerName: name,
          createdAt: at,
          updatedAt: at,
          recoverySentAt: nudged || recovered ? new Date(at.getTime() + 4 * 60 * 60_000) : null,
        })
        .returning({ id: cart.id })
      if (!c) continue
      const lineCount = r() < 0.7 ? 1 : 2
      await db.insert(cartLine).values(
        Array.from({ length: lineCount }, () => {
          const v = pick(variants, r)
          return {
            storeId,
            cartId: c.id,
            variantId: v.id,
            quantity: r() < 0.85 ? 1 : 2,
            unitPricePaise: v.pricePaise,
          }
        }),
      )
      if (nudged || recovered) {
        await db.insert(notification).values({
          storeId,
          cartId: c.id,
          channel: 'log',
          template: 'checkout_recovery',
          to: email,
          status: 'sent',
        })
      }
    }
    console.log(`demo: created ${DRAFT_COUNT} drafts and ${CART_COUNT} abandoned carts`)
  } finally {
    await db.$client.end()
  }
}

if ((import.meta as { main?: boolean }).main) {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  await seedDemoDrafts(url, { clean: process.argv.includes('--clean') })
}
