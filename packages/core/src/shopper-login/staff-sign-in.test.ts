/** SOURCE OF TRUTH: "Sign in as customer" database tests — the ticket works once, for its own store, within 2 minutes; the session it starts records the staff member and ends after an hour; the customer's timeline notes it; erased customers are refused */
import {
  createDb,
  customer,
  customerLoginTicket,
  customerNote,
  customerSession,
  type StoreTx,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { customerForSession } from '../accounts/auth'
import {
  mintStaffSignIn,
  redeemStaffSignIn,
  STAFF_SESSION_TTL_MS,
  STAFF_SIGN_IN_TTL_MS,
  staffSignInNote,
} from './staff-sign-in'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-only-settings-secret-value'
const NOW = new Date('2026-11-22T10:00:00Z')
const STAFF = { userId: 'staff-user-1', name: 'Test Staff', email: 'staff@example.com' }

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const run = <T>(storeId: string, fn: (ctx: { storeId: string; tx: StoreTx }) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

async function makeStore(slug = 'test-store'): Promise<string> {
  const [s] = await owner.insert(store).values({ slug, name: 'Test store' }).returning()
  return s?.id as string
}

async function makeCustomer(storeId: string, email = 'shopper@example.com') {
  const [c] = await owner
    .insert(customer)
    .values({ storeId, email, name: 'Test Shopper' })
    .returning()
  return c?.id as string
}

const mint = (storeId: string, customerId: string, at = NOW) =>
  run(storeId, (ctx) => mintStaffSignIn(ctx, { customerId, staff: STAFF }, at))

describe('sign in as customer', () => {
  it('starts a one-hour session marked with the staff member, once', async () => {
    const storeId = await makeStore()
    const customerId = await makeCustomer(storeId)
    const minted = await mint(storeId, customerId)
    if (!minted.ok) throw new Error('mint failed')
    expect(minted.customerName).toBe('Test Shopper')

    const later = new Date(NOW.getTime() + 30_000)
    const redeemed = await run(storeId, (ctx) => redeemStaffSignIn(ctx, minted.token, later))
    if (!redeemed.ok) throw new Error('redeem failed')
    expect(redeemed.customerId).toBe(customerId)
    expect(redeemed.impersonatedBy).toBe(STAFF.userId)
    expect(redeemed.expiresAt.getTime()).toBe(later.getTime() + STAFF_SESSION_TTL_MS)

    const [row] = await owner
      .select()
      .from(customerSession)
      .where(eq(customerSession.customerId, customerId))
    expect(row?.impersonatedBy).toBe(STAFF.userId)

    const me = await run(storeId, (ctx) =>
      customerForSession(ctx, redeemed.token, SECRET, new Date(later.getTime() + 1000)),
    )
    expect(me?.id).toBe(customerId)
    expect(me?.impersonatedBy).toBe(STAFF.userId)
    // An hour later the session is gone.
    const after = new Date(later.getTime() + STAFF_SESSION_TTL_MS + 1000)
    expect(
      await run(storeId, (ctx) => customerForSession(ctx, redeemed.token, SECRET, after)),
    ).toBe(null)

    // Single use.
    expect(await run(storeId, (ctx) => redeemStaffSignIn(ctx, minted.token, later))).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('notes the sign-in on the customer timeline with the staff member', async () => {
    const storeId = await makeStore()
    const customerId = await makeCustomer(storeId)
    await mint(storeId, customerId)
    const notes = await owner
      .select()
      .from(customerNote)
      .where(eq(customerNote.customerId, customerId))
    expect(notes).toHaveLength(1)
    expect(notes[0]?.body).toBe(staffSignInNote(STAFF.name))
    expect(notes[0]?.author).toBe(STAFF.email)
  })

  it('refuses an expired ticket, and a token from another store', async () => {
    const storeId = await makeStore()
    const other = await makeStore('other-store')
    const customerId = await makeCustomer(storeId)
    const first = await mint(storeId, customerId)
    if (!first.ok) throw new Error('mint failed')
    const late = new Date(NOW.getTime() + STAFF_SIGN_IN_TTL_MS + 1)
    expect(await run(storeId, (ctx) => redeemStaffSignIn(ctx, first.token, late))).toEqual({
      ok: false,
      reason: 'expired',
    })

    const second = await mint(storeId, customerId)
    if (!second.ok) throw new Error('mint failed')
    expect(await run(other, (ctx) => redeemStaffSignIn(ctx, second.token, NOW))).toEqual({
      ok: false,
      reason: 'invalid',
    })
    // The other store's attempt did not spend it.
    const [left] = await owner
      .select({ id: customerLoginTicket.id })
      .from(customerLoginTicket)
      .where(eq(customerLoginTicket.kind, 'staff_sign_in'))
    expect(left).toBeTruthy()
  })

  it('refuses an erased customer and an unknown one', async () => {
    const storeId = await makeStore()
    const customerId = await makeCustomer(storeId)
    await owner.update(customer).set({ anonymisedAt: NOW }).where(eq(customer.id, customerId))
    expect(await mint(storeId, customerId)).toEqual({ ok: false, reason: 'unavailable' })
    expect(await mint(storeId, '00000000-0000-4000-8000-000000000000')).toEqual({
      ok: false,
      reason: 'not_found',
    })
  })
})
