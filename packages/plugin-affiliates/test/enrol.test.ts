import { address, createDb, customer, order, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { enrolFromOrder, enrolOffer, enrolOrderId, orderLinks } from '../src/enrol'
import { createProgram } from '../src/programs'
import { defaultProgramRules } from '../src/settings'

/*
 * Share and earn: the signed invite (bad, expired, another store's), which orders earn one,
 * the one tap making the order's own buyer an approved affiliate, and a second tap returning
 * the same affiliate.
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

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

const INVITE = { mode: 'invite', programId: null, minOrderPaise: 500_00 }

async function seed(autoEnrol: Record<string, unknown> = INVITE) {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner
    .insert(store)
    .values({
      slug,
      name: slug,
      apps: { installed: ['affiliates'], settings: { affiliates: { autoEnrol } } },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [c] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha', phone: '+919000000001' })
    .returning()
  if (!c) throw new Error('seed')
  return { storeId: s.id, customerId: c.id }
}

let numbers = 7000
async function placeOrder(
  storeId: string,
  customerId: string | null,
  over: Partial<typeof order.$inferInsert> = {},
) {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Asha',
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
      number: numbers++,
      customerId,
      email: 'asha@example.com',
      shippingAddressId: a?.id,
      status: 'open',
      paymentStatus: 'paid',
      subtotalPaise: 1180_00,
      totalPaise: 1180_00,
      ...over,
    })
    .returning()
  if (!o) throw new Error('seed')
  return o
}

const linkCtx = (storeId: string, surface: 'email' | 'storefront') => ({
  storeId,
  inStore: <T>(fn: (tx: StoreTx) => Promise<T>) => inStore(storeId, fn),
  settingsSecret: SECRET,
  storefrontUrl: 'https://shop.example.com',
  surface,
})

describe('the invite token', () => {
  it('opens only for its own store and before it expires', async () => {
    const { storeId, customerId } = await seed()
    const o = await placeOrder(storeId, customerId)
    const [link] = await orderLinks(linkCtx(storeId, 'storefront'), o.id)
    const t = decodeURIComponent(link?.url.split('?t=')[1] ?? '')
    expect(enrolOrderId(t, storeId, SECRET)).toBe(o.id)
    expect(enrolOrderId(t, crypto.randomUUID(), SECRET)).toBeNull()
    expect(enrolOrderId(`${t}x`, storeId, SECRET)).toBeNull()
    expect(enrolOrderId(t, storeId, 'another-secret-another-secret-0000')).toBeNull()
    const later = new Date(Date.now() + 91 * 24 * 60 * 60 * 1000)
    expect(enrolOrderId(t, storeId, SECRET, later)).toBeNull()
  })
})

describe('Share and earn', () => {
  it('offers the link on a real order above the minimum, with the program’s rate', async () => {
    const { storeId, customerId } = await seed()
    const o = await placeOrder(storeId, customerId)
    const [link] = await orderLinks(linkCtx(storeId, 'email'), o.id)
    expect(link?.label).toBe('Share and earn 10% on every sale')
    expect(link?.url.startsWith('https://shop.example.com/affiliate/join?t=')).toBe(true)
    const [onPage] = await orderLinks(linkCtx(storeId, 'storefront'), o.id)
    expect(onPage?.url.startsWith('/affiliate/join?t=')).toBe(true)
  })

  it('offers nothing when off, below the minimum, for a test order or a guest', async () => {
    const off = await seed({ mode: 'off' })
    expect(
      await orderLinks(
        linkCtx(off.storeId, 'email'),
        (await placeOrder(off.storeId, off.customerId)).id,
      ),
    ).toEqual([])
    const { storeId, customerId } = await seed()
    const small = await placeOrder(storeId, customerId, { totalPaise: 300_00 })
    const test = await placeOrder(storeId, customerId, { isTest: true })
    const guest = await placeOrder(storeId, null)
    for (const o of [small, test, guest]) {
      expect(await inStore(storeId, (tx) => enrolOffer(tx, storeId, o.id))).toBeNull()
    }
  })

  it('makes the buyer an approved affiliate in the chosen program, once', async () => {
    const { storeId, customerId } = await seed()
    const customers = await inStore(storeId, (tx) =>
      createProgram(tx, storeId, { name: 'Customers', rules: defaultProgramRules }),
    )
    await owner.update(store).set({
      apps: {
        installed: ['affiliates'],
        settings: { affiliates: { autoEnrol: { ...INVITE, programId: customers.id } } },
      },
    })
    const o = await placeOrder(storeId, customerId)
    const joined = await inStore(storeId, (tx) => enrolFromOrder(tx, storeId, o.id, SECRET))
    expect(joined).toMatchObject({
      customerId,
      status: 'approved',
      source: 'enrolled',
      programId: customers.id,
    })
    expect(joined?.couponCode).toBeTruthy()
    const again = await inStore(storeId, (tx) => enrolFromOrder(tx, storeId, o.id, SECRET))
    expect(again?.id).toBe(joined?.id)
    // An affiliate already: no more invites.
    expect(await orderLinks(linkCtx(storeId, 'email'), o.id)).toEqual([])
  })
})
