import {
  address,
  createDb,
  customer,
  order,
  orderLine,
  product,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { applyAsAffiliate, savePayoutDetails } from '../src/affiliates'
import { approveDueCommissions, creditOrder, startHold } from '../src/commissions'
import { createPayouts } from '../src/payouts'
import { affiliatePayout } from '../src/schema'
import { type AffiliateSettings, defaultAffiliateSettings } from '../src/settings'

/*
 * "Create payouts" pressed twice at once (a double click, two staff, a retried request): the
 * same approved commissions must end up in one pending payout, never two. A second payout for
 * the same money is what a merchant would pay twice from the bank file.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-test-secret-test-secret-00'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const settings: AffiliateSettings = { ...defaultAffiliateSettings, approval: 'auto' }
const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function seedApprovedCommission() {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const storeId = s.id
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: 'mat', title: 'Mat' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'Default', pricePaise: 11_800_00 })
    .returning()
  const [c] = await owner
    .insert(customer)
    .values({ storeId, email: 'affiliate@example.com', name: 'Aff' })
    .returning()
  const a = await inStore(storeId, (tx) =>
    applyAsAffiliate(
      tx,
      storeId,
      {
        customerId: c?.id as string,
        email: 'affiliate@example.com',
        phone: '+91 98765 43210',
        name: 'Aff',
        social: '@aff',
        message: '',
      },
      settings,
      SECRET,
    ),
  )
  await inStore(storeId, (tx) =>
    savePayoutDetails(tx, a.id, { method: 'upi', upiId: 'aff@upi' }, SECRET),
  )
  const [addr] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Buyer',
      line1: '5 Park Street',
      city: 'Kolkata',
      stateCode: 'WB',
      pincode: '700016',
      phone: '9000000001',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: 1001,
      email: 'buyer@example.com',
      phone: '+91 90000 00001',
      shippingAddressId: addr?.id,
      status: 'open',
      paymentStatus: 'paid',
      subtotalPaise: 11_800_00,
      totalPaise: 11_800_00,
      attribution: { channel: 'affiliate', ref: a.code, at: new Date().toISOString() },
    })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId: v?.id as string,
    quantity: 1,
    unitPricePaise: 11_800_00,
    gstRatePercent: 18,
  })
  const now = new Date()
  await inStore(storeId, async (tx) => {
    await creditOrder(tx, storeId, o?.id as string, settings, SECRET)
    await startHold(
      tx,
      o?.id as string,
      { ...settings, holdDays: 0 },
      new Date(now.getTime() - 1000),
    )
    await approveDueCommissions(tx, storeId, settings, now)
  })
  return storeId
}

describe('createPayouts under a double click', () => {
  it('two requests at once make one payout for the commission, not two', async () => {
    const storeId = await seedApprovedCommission()
    let release: () => void = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    // The first request creates its payout and holds its transaction open...
    const first = inStore(storeId, async (tx) => {
      const made = await createPayouts(tx, storeId, settings)
      await held
      return made
    })
    // ...while the second one reads the same commissions, still unassigned to it.
    await new Promise((r) => setTimeout(r, 300))
    const second = inStore(storeId, (tx) => createPayouts(tx, storeId, settings))
    await new Promise((r) => setTimeout(r, 500))
    release()
    const [a, b] = await Promise.all([first, second])
    expect(a.length + b.length).toBe(1)
    const payouts = await owner
      .select()
      .from(affiliatePayout)
      .where(eq(affiliatePayout.storeId, storeId))
    expect(payouts).toHaveLength(1)
    expect(payouts[0]?.grossPaise).toBe(1_000_00)
  })
})
