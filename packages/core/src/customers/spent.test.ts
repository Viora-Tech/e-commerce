/** SOURCE OF TRUTH: "Amount spent" tests — WHAT: unpaid orders count nothing, paid orders their total, refunds come off (ours and an imported order's), drafts and test orders never count / WHY: the old sum of totals called a customer who paid ₹0 a VIP (audit #132) */
import { createDb, customer, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { seedStore } from '../testing/usage-seed'
import { customerSpentSql } from './spent'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

type OrderSeed = {
  number: number
  total: number
  payment: string
  status?: string
  refundedImport?: number
}

async function addOrder(storeId: string, customerId: string, o: OrderSeed) {
  const meta = o.refundedImport === undefined ? null : { refundedPaise: o.refundedImport }
  const [row] = await owner.execute<{ id: string }>(sql`
    insert into "order" (id, store_id, number, customer_id, subtotal_paise, total_paise, status,
      payment_status, import_meta)
    values (gen_random_uuid(), ${storeId}, ${o.number}, ${customerId}, ${o.total}, ${o.total},
      ${o.status ?? 'open'}, ${o.payment}, ${meta ? JSON.stringify(meta) : null}::jsonb)
    returning id`)
  return row?.id as string
}

async function spentOf(storeId: string, customerId: string): Promise<number> {
  const [row] = await withStore(app, storeId, (tx) =>
    tx
      .select({ paise: customerSpentSql(sql`${customer.id}`) })
      .from(customer)
      .where(eq(customer.id, customerId)),
  )
  return row?.paise ?? 0
}

describe('customerSpentSql', () => {
  it('counts money received and kept, not every order total', async () => {
    const storeId = await seedStore(owner, 'spent')
    const [c] = await owner
      .insert(customer)
      .values({ storeId, email: 'asha@x.co', name: 'Asha' })
      .returning()
    const id = c?.id as string
    await addOrder(storeId, id, { number: 1, total: 10_000, payment: 'unpaid' })
    expect(await spentOf(storeId, id)).toBe(0)

    const paid = await addOrder(storeId, id, { number: 2, total: 20_000, payment: 'paid' })
    expect(await spentOf(storeId, id)).toBe(20_000)

    const [pay] = await owner.execute<{ id: string }>(sql`
      insert into "payment" (id, store_id, order_id, provider, provider_ref, status, amount_paise)
      values (gen_random_uuid(), ${storeId}, ${paid}, 'manual', 'ref-2', 'captured', 20_000)
      returning id`)
    await owner.execute(sql`
      insert into "refund" (id, store_id, order_id, payment_id, amount_paise, status)
      values (gen_random_uuid(), ${storeId}, ${paid}, ${pay?.id}, 5_000, 'processed')`)
    expect(await spentOf(storeId, id)).toBe(15_000)

    // An imported Shopify order: its own refunded amount comes off.
    await addOrder(storeId, id, {
      number: 3,
      total: 8_000,
      payment: 'refunded',
      refundedImport: 8_000,
    })
    expect(await spentOf(storeId, id)).toBe(15_000)

    // A cancelled unpaid order and a draft count nothing.
    await addOrder(storeId, id, { number: 4, total: 9_000, payment: 'unpaid', status: 'cancelled' })
    await addOrder(storeId, id, { number: 5, total: 9_000, payment: 'paid', status: 'draft' })
    expect(await spentOf(storeId, id)).toBe(15_000)
  })
})
