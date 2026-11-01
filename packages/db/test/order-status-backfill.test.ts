import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { order, orderLine, payment, product, refund, store, variant } from '../src/schema'
import { shipment } from '../src/shipping-schema'
import { resetDb } from './reset'
import { retryOnDeadlock } from './retry-deadlock'

/*
 * 0062 splits `order.status` into lifecycle, payment and fulfilment. These
 * fixtures are rows as the old schema left them (old statuses, and demo rows
 * whose status disagrees with their lines), put back by dropping the new
 * checks; the migration is then run again and must derive every status from
 * the facts, the same way `recomputeOrderStatuses` does, and land on the same
 * values when run a second time.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)

const MIGRATION = readFileSync(
  join(import.meta.dirname, '..', 'drizzle', '0062_order_status_split.sql'),
  'utf8',
)

async function runMigration() {
  for (const statement of MIGRATION.split('--> statement-breakpoint')) {
    if (statement.trim()) await retryOnDeadlock(() => owner.execute(sql.raw(statement)))
  }
}

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  // Whatever happened above, leave the schema as the migration defines it.
  await runMigration()
  await owner.$client.end()
})

type Fixture = {
  old: string
  totalPaise?: number
  lines?: { quantity: number; packed: number; giftCard?: boolean }[]
  payments?: {
    status: string
    amountPaise: number
    refundNeeded?: boolean
    refundedPaise?: number
  }[]
  shipments?: string[]
  balanceDuePaise?: number
  importMeta?: Record<string, string | null>
}

async function seed(fixtures: Record<string, Fixture>) {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'p', title: 'P' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'V', pricePaise: 500 })
    .returning()
  await retryOnDeadlock(() =>
    owner.execute(sql`alter table "order" drop constraint if exists "order_status_check"`),
  )
  const ids: Record<string, string> = {}
  let number = 1
  for (const [name, f] of Object.entries(fixtures)) {
    const total = f.totalPaise ?? 1000
    const [o] = await owner
      .insert(order)
      .values({
        storeId: s.id,
        number: number++,
        subtotalPaise: total,
        totalPaise: total,
        balanceDuePaise: f.balanceDuePaise ?? null,
        depositPaise: f.balanceDuePaise ? total - f.balanceDuePaise : null,
        importedFrom: f.importMeta ? 'shopify' : null,
        importMeta: f.importMeta ? { name: `#${number}`, ...f.importMeta } : null,
      })
      .returning()
    if (!o) throw new Error('seed')
    ids[name] = o.id
    await owner.execute(sql`update "order" set status = ${f.old} where id = ${o.id}`)
    for (const l of f.lines ?? [{ quantity: 2, packed: 0 }]) {
      await owner.insert(orderLine).values({
        storeId: s.id,
        orderId: o.id,
        variantId: v?.id as string,
        quantity: l.quantity,
        fulfilledQuantity: l.packed,
        unitPricePaise: 500,
        giftCard: l.giftCard ?? false,
      })
    }
    let i = 0
    for (const pay of f.payments ?? []) {
      const [row] = await owner
        .insert(payment)
        .values({
          storeId: s.id,
          orderId: o.id,
          provider: 'razorpay',
          providerRef: `${o.id}-${i++}`,
          status: pay.status as 'captured',
          amountPaise: pay.amountPaise,
          refundNeeded: pay.refundNeeded ?? false,
          multiCapture: true,
        })
        .returning()
      if (pay.refundedPaise && row) {
        await owner.insert(refund).values({
          storeId: s.id,
          orderId: o.id,
          paymentId: row.id,
          amountPaise: pay.refundedPaise,
          status: 'processed',
        })
      }
    }
    for (const status of f.shipments ?? []) {
      await owner.insert(shipment).values({
        storeId: s.id,
        orderId: o.id,
        provider: 'delhivery',
        waybill: `${o.id}-${status}`,
        status: status as 'created',
      })
    }
  }
  return ids
}

async function snapshot(ids: Record<string, string>) {
  const out: Record<string, unknown[]> = {}
  for (const [name, id] of Object.entries(ids)) {
    const [o] = await owner.select().from(order).where(eq(order.id, id))
    out[name] = [
      o?.status,
      o?.paymentStatus,
      o?.fulfillmentStatus,
      o?.checkoutPaidAt ? 'checkout paid' : null,
      o?.deliveredAt ? 'hand delivered' : null,
    ]
  }
  return out
}

describe('0062 order status split backfill', () => {
  it('derives every status from lines, payments and shipments, idempotently', async () => {
    const captured = [{ status: 'captured', amountPaise: 1000 }]
    const ids = await seed({
      codPlaced: { old: 'placed', payments: [{ status: 'pending', amountPaise: 1000 }] },
      paid: { old: 'paid', payments: captured },
      demoFulfilledNothingPacked: { old: 'fulfilled', payments: captured },
      deliveredByHand: {
        old: 'delivered',
        payments: captured,
        lines: [{ quantity: 2, packed: 2 }],
      },
      inTransit: {
        old: 'fulfilled',
        payments: captured,
        lines: [{ quantity: 2, packed: 2 }],
        shipments: ['cancelled', 'in_transit'],
      },
      courierDelivered: {
        old: 'delivered',
        lines: [{ quantity: 2, packed: 2 }],
        payments: [{ status: 'pending', amountPaise: 1000 }],
        shipments: ['delivered'],
      },
      rto: {
        old: 'fulfilled',
        lines: [{ quantity: 2, packed: 2 }],
        payments: [{ status: 'pending', amountPaise: 1000 }],
        shipments: ['rto'],
      },
      lateCaptureOnCancelled: {
        old: 'cancelled',
        payments: [{ status: 'captured', amountPaise: 1000, refundNeeded: true }],
      },
      partlyRefunded: {
        old: 'paid',
        payments: [{ status: 'captured', amountPaise: 1000, refundedPaise: 300 }],
      },
      draft: { old: 'draft' },
      depositIn: {
        old: 'paid',
        balanceDuePaise: 750,
        payments: [{ status: 'captured', amountPaise: 250 }],
      },
      giftCardsOnly: {
        old: 'fulfilled',
        payments: captured,
        lines: [{ quantity: 2, packed: 2, giftCard: true }],
      },
      importedFulfilled: {
        old: 'fulfilled',
        importMeta: { financialStatus: 'paid', fulfillmentStatus: 'fulfilled' },
      },
      importedCancelled: {
        old: 'cancelled',
        importMeta: {
          financialStatus: 'refunded',
          fulfillmentStatus: null,
          cancelledAt: '2025-01-02',
        },
      },
    })

    await runMigration()
    const first = await snapshot(ids)
    expect(first).toEqual({
      codPlaced: ['open', 'unpaid', 'unfulfilled', null, null],
      paid: ['open', 'paid', 'unfulfilled', 'checkout paid', null],
      demoFulfilledNothingPacked: ['open', 'paid', 'unfulfilled', 'checkout paid', null],
      deliveredByHand: ['completed', 'paid', 'delivered', 'checkout paid', 'hand delivered'],
      inTransit: ['open', 'paid', 'shipped', 'checkout paid', null],
      courierDelivered: ['open', 'unpaid', 'delivered', null, 'hand delivered'],
      rto: ['open', 'unpaid', 'returned', null, null],
      lateCaptureOnCancelled: ['cancelled', 'refund_needed', 'unfulfilled', null, null],
      partlyRefunded: ['open', 'partially_refunded', 'unfulfilled', 'checkout paid', null],
      draft: ['draft', 'unpaid', 'unfulfilled', null, null],
      depositIn: ['open', 'partially_paid', 'unfulfilled', 'checkout paid', null],
      giftCardsOnly: ['completed', 'paid', 'fulfilled', 'checkout paid', null],
      importedFulfilled: ['completed', 'paid', 'fulfilled', 'checkout paid', null],
      importedCancelled: ['cancelled', 'refunded', 'unfulfilled', 'checkout paid', null],
    })

    // Run again: nothing moves.
    await runMigration()
    expect(await snapshot(ids)).toEqual(first)

    // The lifecycle check is back: an old status can no longer be written.
    await expect(
      owner.execute(sql`update "order" set status = 'placed' where id = ${ids.paid as string}`),
    ).rejects.toThrow()
  })

  it('points the worker scans at unpaid open orders', async () => {
    const ids = await seed({
      manualUnpaid: { old: 'placed', payments: [{ status: 'pending', amountPaise: 1000 }] },
      manualPaid: { old: 'paid', payments: [{ status: 'captured', amountPaise: 1000 }] },
    })
    await runMigration()
    const pending = () =>
      owner.execute<{ id: string }>(sql`select stores_with_pending_manual_orders() as id`)
    await owner
      .update(order)
      .set({ paymentMethod: 'manual' })
      .where(eq(order.id, ids.manualPaid as string))
    expect(await pending()).toHaveLength(0)
    await owner
      .update(order)
      .set({ paymentMethod: 'manual' })
      .where(eq(order.id, ids.manualUnpaid as string))
    const [s] = await owner.select().from(store)
    expect((await pending()).map((r) => r.id)).toEqual([s?.id])
  })
})
