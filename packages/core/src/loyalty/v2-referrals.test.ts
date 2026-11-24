/** SOURCE OF TRUTH: loyalty referral tests — WHAT: a friend with a code gets their welcome code at once, the referrer is rewarded only after the friend's delivered order passes the return window, and the fraud checks (self, same inbox, phone, address, device, existing customer, limit, one referral per friend, unpaid or cancelled orders) give nothing / WHY: referral rewards are money handed to strangers; each refusal must happen before anything is given */
import { customer, discount, loyaltyEntry, loyaltyReferral, order } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  addCustomer,
  app,
  at,
  deliveredOrder,
  owner,
  run,
  type Seed,
  seed,
  settingsWith,
  T0,
} from './fixtures.test-util'
import { pointsSummary } from './ledger'
import { ensureMember } from './member'
import { attachReferral, completeDueReferrals, referralOrderDelivered } from './referrals'
import type { LoyaltySettings } from './settings'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const S = settingsWith({
  referrals: {
    enabled: true,
    referrerReward: { kind: 'points', value: 200 },
    friendReward: { kind: 'percent', value: 10 },
    maxPerMember: 2,
    referrerTag: 'referrer',
    friendTag: 'referred',
    orderTag: 'referral-order',
    codeDays: 30,
  },
})

const codeOf = async (t: Seed) =>
  (await run(t.storeId, (ctx) => ensureMember(ctx, t.customerId, T0))).referralCode

const attach = (
  t: Seed,
  friendId: string,
  code: string,
  s: LoyaltySettings = S,
  deviceId?: string,
) => run(t.storeId, (ctx) => attachReferral(ctx, { friendId, code, deviceId }, s, T0))

describe('a good referral', () => {
  it('friend gets a 10% code now; referrer gets 200 points after the friend’s order is delivered and kept', async () => {
    const t = await seed()
    const code = await codeOf(t)
    const friend = await addCustomer(t, { email: 'meera@example.com' })
    const ref = await attach(t, friend, code.toLowerCase())
    expect(ref).toMatchObject({ status: 'pending', referrerId: t.customerId, rejectReason: null })
    const [d] = await owner.select().from(discount)
    expect(d).toMatchObject({
      method: 'percent',
      value: 1_000,
      eligibleIds: [friend],
      usageLimit: 1,
    })
    const [fc] = await owner.select().from(customer).where(eq(customer.id, friend))
    expect(fc?.tags).toEqual(['referred'])
    // A second attach (sign-up, then checkout) changes nothing.
    expect((await attach(t, friend, code))?.id).toBe(ref?.id)
    const o = await deliveredOrder(t, 150_000, { customerId: friend, email: 'meera@example.com' })
    const moved = await run(t.storeId, (ctx) => referralOrderDelivered(ctx, o.orderId, S, T0))
    expect(moved?.status).toBe('friend_ordered')
    const [ot] = await owner.select().from(order).where(eq(order.id, o.orderId))
    expect(ot?.tags).toEqual(['referral-order'])
    expect(await run(t.storeId, (ctx) => completeDueReferrals(ctx, S, at(1)))).toBe(0)
    expect(await run(t.storeId, (ctx) => completeDueReferrals(ctx, S, at(30)))).toBe(1)
    expect(await run(t.storeId, (ctx) => completeDueReferrals(ctx, S, at(31)))).toBe(0)
    const points = await run(
      t.storeId,
      async (ctx) => (await pointsSummary(ctx, t.customerId, 0, at(31))).points,
    )
    expect(points).toBe(200)
    const [rc] = await owner.select().from(customer).where(eq(customer.id, t.customerId))
    expect(rc?.tags).toEqual(['referrer'])
  })

  it('points as the friend’s reward wait for their first order’s return window', async () => {
    const t = await seed()
    const s = settingsWith({
      referrals: { ...S.referrals, friendReward: { kind: 'points', value: 50 } },
    })
    const friend = await addCustomer(t, { email: 'meera@example.com' })
    await attach(t, friend, await codeOf(t), s)
    expect(await owner.select().from(discount)).toHaveLength(0)
    const o = await deliveredOrder(t, 150_000, { customerId: friend })
    await run(t.storeId, (ctx) => referralOrderDelivered(ctx, o.orderId, s, T0))
    const [e] = await owner.select().from(loyaltyEntry).where(eq(loyaltyEntry.customerId, friend))
    expect(e).toMatchObject({
      source: 'referral',
      status: 'pending',
      points: 50,
      orderId: o.orderId,
    })
  })
})

describe('fraud checks', () => {
  it('refuses self-referral, the same inbox, phone, address or device, and an existing customer', async () => {
    const t = await seed()
    const code = await codeOf(t)
    await owner
      .update(customer)
      .set({
        phoneIndex: 'p1',
        defaultAddress: { line1: '12 MG Road', pincode: '560001' } as never,
      })
      .where(eq(customer.id, t.customerId))
    expect((await attach(t, t.customerId, code))?.rejectReason).toBe('self')
    const alias = await addCustomer(t, { email: 'asha+2@example.com' })
    expect((await attach(t, alias, code))?.rejectReason).toBe('same_email')
    const phone = await addCustomer(t, { email: 'p@example.com', phoneIndex: 'p1' })
    expect((await attach(t, phone, code))?.rejectReason).toBe('same_phone')
    const home = await addCustomer(t, {
      email: 'h@example.com',
      defaultAddress: { line1: '12, mg road', pincode: '560001' } as never,
    })
    expect((await attach(t, home, code))?.rejectReason).toBe('same_address')
    const a = await addCustomer(t, { email: 'd1@example.com' })
    const b = await addCustomer(t, { email: 'd2@example.com' })
    expect((await attach(t, a, code, S, 'dev-1'))?.status).toBe('pending')
    expect((await attach(t, b, code, S, 'dev-1'))?.rejectReason).toBe('same_device')
    expect((await attach(t, t.otherId, code))?.status).toBe('pending')
    await deliveredOrder(t, 100_000, { customerId: t.otherId })
    const old = await addCustomer(t, { email: 'old@example.com' })
    await deliveredOrder(t, 100_000, { customerId: old })
    expect((await attach(t, old, code))?.rejectReason).toMatch(/existing_customer|limit/)
    // Only the two good referrals made codes.
    expect(await owner.select().from(discount)).toHaveLength(2)
  })

  it('a member can refer at most the limit; a leaked code works once per new customer', async () => {
    const t = await seed()
    const code = await codeOf(t)
    const f = await Promise.all(
      ['x1', 'x2', 'x3'].map((e) => addCustomer(t, { email: `${e}@example.com` })),
    )
    for (const id of f) await attach(t, id, code)
    const rows = await owner.select().from(loyaltyReferral)
    expect(rows.map((r) => r.rejectReason ?? r.status).sort()).toEqual([
      'limit',
      'pending',
      'pending',
    ])
    // Ravi's own code cannot re-refer a friend Asha already referred.
    const raviCode = (await run(t.storeId, (ctx) => ensureMember(ctx, t.otherId, T0))).referralCode
    expect((await attach(t, f[0] as string, raviCode))?.referrerId).toBe(t.customerId)
  })

  it('an unpaid or cancelled first order does not move the referral; a refunded one is rejected at the end', async () => {
    const t = await seed()
    const friend = await addCustomer(t, { email: 'meera@example.com' })
    await attach(t, friend, await codeOf(t))
    const unpaid = await deliveredOrder(t, 100_000, {
      customerId: friend,
      paymentMethod: 'razorpay',
      paymentStatus: 'unpaid',
    })
    expect(
      await run(t.storeId, (ctx) => referralOrderDelivered(ctx, unpaid.orderId, S, T0)),
    ).toBeNull()
    const ok = await deliveredOrder(t, 100_000, { customerId: friend })
    await run(t.storeId, (ctx) => referralOrderDelivered(ctx, ok.orderId, S, T0))
    await owner.update(order).set({ status: 'cancelled' }).where(eq(order.id, ok.orderId))
    expect(await run(t.storeId, (ctx) => completeDueReferrals(ctx, S, at(30)))).toBe(0)
    const [r] = await owner.select().from(loyaltyReferral)
    expect(r).toMatchObject({ status: 'rejected', rejectReason: 'order_not_kept' })
  })

  it('does nothing while referrals are off or for an unknown code', async () => {
    const t = await seed()
    const friend = await addCustomer(t, { email: 'meera@example.com' })
    expect(await attach(t, friend, await codeOf(t), settingsWith())).toBeNull()
    expect(await attach(t, friend, 'NOPE1234')).toBeNull()
  })
})
