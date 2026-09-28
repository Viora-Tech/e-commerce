import {
  createDb,
  customer,
  customerAddress,
  customerLoginCode,
  customerSession,
  order,
  orderLine,
  payment,
  product,
  type StoreTx,
  shipment,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { decryptCustomerPhone } from '../customers/phone-crypto'
import { recomputeOrderStatuses } from '../order/recompute'
import {
  createAddress,
  deleteAddress,
  listAddresses,
  MAX_ADDRESSES,
  rememberCheckoutAddress,
  setDefaultAddress,
  updateAddress,
} from './addresses'
import {
  customerForSession,
  LOGIN_CODE_MAX_ATTEMPTS,
  LOGIN_CODE_RESEND_MS,
  LOGIN_CODE_TTL_MS,
  requestLoginCode,
  revokeCustomerSession,
  verifyLoginCode,
} from './auth'
import { deliverLoginCode } from './deliver-code'
import { getCustomerOrder, listCustomerOrders, paymentState, reorderLines } from './orders'
import { updateProfile } from './profile'
import { normaliseMobile } from './schemas'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const TEST_SECRET = 'test-only-settings-secret-value'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const run = <T>(storeId: string, fn: (ctx: { storeId: string; tx: StoreTx }) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

async function makeStore(slug: string): Promise<string> {
  const [s] = await owner.insert(store).values({ slug, name: slug.toUpperCase() }).returning()
  return s?.id as string
}

async function signIn(storeId: string, email: string, now = new Date()) {
  const req = await run(storeId, (ctx) => requestLoginCode(ctx, email, now))
  if (!req.ok) throw new Error(req.reason)
  const res = await run(storeId, (ctx) => verifyLoginCode(ctx, email, req.code, now))
  if (!res.ok) throw new Error(res.reason)
  return res
}

const HOME = {
  name: 'Asha Rao',
  line1: '12 MG Road',
  line2: '',
  city: 'Gurugram',
  stateCode: 'HR',
  pincode: '122001',
  phone: '+91 98765 43210',
}

describe('storefront sign-in', () => {
  it('creates the customer on first sign-in and resolves the session to them', async () => {
    const storeId = await makeStore('a')
    const { token, customerId } = await signIn(storeId, ' Asha@Example.com ')
    const me = await run(storeId, (ctx) => customerForSession(ctx, token, TEST_SECRET))
    expect(me).toMatchObject({ id: customerId, email: 'asha@example.com' })
    // Only hashes are stored.
    const [s] = await owner.select().from(customerSession)
    expect(s?.tokenHash).not.toContain(token)
    const codes = await owner.select().from(customerLoginCode)
    expect(codes).toHaveLength(0)
  })

  it('links to the existing customer row for that email', async () => {
    const storeId = await makeStore('a')
    const [c] = await owner
      .insert(customer)
      .values({ storeId, email: 'asha@example.com', name: 'Asha' })
      .returning()
    const { customerId } = await signIn(storeId, 'asha@example.com')
    expect(customerId).toBe(c?.id)
  })

  it('keeps codes and sessions inside their store', async () => {
    const a = await makeStore('a')
    const b = await makeStore('b')
    const req = await run(a, (ctx) => requestLoginCode(ctx, 'asha@example.com'))
    if (!req.ok) throw new Error('no code')
    // The same code typed on store B is worthless there.
    expect(await run(b, (ctx) => verifyLoginCode(ctx, 'asha@example.com', req.code))).toEqual({
      ok: false,
      reason: 'invalid',
    })
    const res = await run(a, (ctx) => verifyLoginCode(ctx, 'asha@example.com', req.code))
    if (!res.ok) throw new Error('not signed in')
    expect(await run(b, (ctx) => customerForSession(ctx, res.token, TEST_SECRET))).toBeNull()
    expect(await run(a, (ctx) => customerForSession(ctx, res.token, TEST_SECRET))).not.toBeNull()

    // Signing in to B with the same email is a different customer.
    const onB = await signIn(b, 'asha@example.com')
    expect(onB.customerId).not.toBe(res.customerId)
  })

  it('refuses a wrong code, locks after too many, and a spent code is gone', async () => {
    const storeId = await makeStore('a')
    const req = await run(storeId, (ctx) => requestLoginCode(ctx, 'x@example.com'))
    if (!req.ok) throw new Error('no code')
    const wrong = req.code === '000000' ? '111111' : '000000'
    for (let i = 1; i < LOGIN_CODE_MAX_ATTEMPTS; i++) {
      expect(await run(storeId, (ctx) => verifyLoginCode(ctx, 'x@example.com', wrong))).toEqual({
        ok: false,
        reason: 'invalid',
      })
    }
    expect(await run(storeId, (ctx) => verifyLoginCode(ctx, 'x@example.com', wrong))).toEqual({
      ok: false,
      reason: 'locked',
    })
    expect(await run(storeId, (ctx) => verifyLoginCode(ctx, 'x@example.com', req.code))).toEqual({
      ok: false,
      reason: 'locked',
    })
    expect(await run(storeId, (ctx) => verifyLoginCode(ctx, 'x@example.com', 'abc'))).toEqual({
      ok: false,
      reason: 'invalid',
    })
    expect(await run(storeId, (ctx) => verifyLoginCode(ctx, 'y@example.com', '123456'))).toEqual({
      ok: false,
      reason: 'invalid',
    })
  })

  it('does not hand out fresh guesses with a resent code', async () => {
    const storeId = await makeStore('a')
    const t0 = new Date()
    const req = await run(storeId, (ctx) => requestLoginCode(ctx, 'x@example.com', t0))
    if (!req.ok) throw new Error('no code')
    const wrong = req.code === '000000' ? '111111' : '000000'
    for (let i = 0; i < LOGIN_CODE_MAX_ATTEMPTS; i++) {
      await run(storeId, (ctx) => verifyLoginCode(ctx, 'x@example.com', wrong, t0))
    }
    const resend = new Date(t0.getTime() + LOGIN_CODE_RESEND_MS + 1)
    expect(await run(storeId, (ctx) => requestLoginCode(ctx, 'x@example.com', resend))).toEqual({
      ok: false,
      reason: 'too_soon',
    })
  })

  it('expires codes, throttles resends and rejects bad emails', async () => {
    const storeId = await makeStore('a')
    const t0 = new Date('2026-09-01T10:00:00Z')
    expect(await run(storeId, (ctx) => requestLoginCode(ctx, 'nope', t0))).toEqual({
      ok: false,
      reason: 'invalid_email',
    })
    const req = await run(storeId, (ctx) => requestLoginCode(ctx, 'x@example.com', t0))
    if (!req.ok) throw new Error('no code')
    expect(
      await run(storeId, (ctx) =>
        requestLoginCode(ctx, 'x@example.com', new Date(t0.getTime() + 1000)),
      ),
    ).toEqual({ ok: false, reason: 'too_soon' })
    const late = new Date(t0.getTime() + LOGIN_CODE_TTL_MS + 1)
    expect(
      await run(storeId, (ctx) => verifyLoginCode(ctx, 'x@example.com', req.code, late)),
    ).toEqual({ ok: false, reason: 'expired' })
    const again = await run(storeId, (ctx) =>
      requestLoginCode(ctx, 'x@example.com', new Date(t0.getTime() + LOGIN_CODE_RESEND_MS + 1)),
    )
    expect(again.ok).toBe(true)
  })

  it('ends a session on sign-out and after it expires', async () => {
    const storeId = await makeStore('a')
    const now = new Date()
    const { token, expiresAt } = await signIn(storeId, 'x@example.com', now)
    expect(
      await run(storeId, (ctx) =>
        customerForSession(ctx, token, TEST_SECRET, new Date(expiresAt.getTime() + 1)),
      ),
    ).toBeNull()
    expect(await run(storeId, (ctx) => customerForSession(ctx, 'short', TEST_SECRET))).toBeNull()
    expect(await run(storeId, (ctx) => customerForSession(ctx, null, TEST_SECRET))).toBeNull()
    await run(storeId, (ctx) => revokeCustomerSession(ctx, token))
    await run(storeId, (ctx) => revokeCustomerSession(ctx, 'bad token!'))
    expect(await run(storeId, (ctx) => customerForSession(ctx, token, TEST_SECRET))).toBeNull()
  })

  it('delivers the code through email channels only', async () => {
    const storeId = await makeStore('a')
    const sent: Message[] = []
    const channel = (id: string, requires: 'email' | 'phone', ok = true): NotificationChannel => ({
      id,
      label: id,
      requires,
      send: async (m) => {
        sent.push(m)
        return ok ? { ok: true, providerRef: id } : { ok: false, error: 'down' }
      },
    })
    const n = await run(storeId, (ctx) =>
      deliverLoginCode(
        ctx,
        { email: 'x@example.com', code: '123456' },
        {
          registry: undefined as never,
          settingsSecret: 'x',
          channels: [
            channel('ses', 'email'),
            channel('wa', 'phone'),
            channel('bad', 'email', false),
          ],
        },
      ),
    )
    expect(n).toBe(1)
    expect(sent).toHaveLength(2)
    expect(sent[0]).toMatchObject({
      template: 'login_code',
      data: { code: '123456', storeName: 'A' },
    })
  })
})

describe('address book', () => {
  it('adds, edits, defaults and deletes addresses for their owner only', async () => {
    const storeId = await makeStore('a')
    const asha = (await signIn(storeId, 'asha@example.com')).customerId
    const ravi = (await signIn(storeId, 'ravi@example.com')).customerId

    const first = await run(storeId, (ctx) => createAddress(ctx, asha, HOME))
    if (!first.ok) throw new Error('create failed')
    const second = await run(storeId, (ctx) =>
      createAddress(ctx, asha, {
        ...HOME,
        line1: '4 Park Street',
        pincode: '700016',
        stateCode: 'WB',
      }),
    )
    if (!second.ok) throw new Error('create failed')
    let book = await run(storeId, (ctx) => listAddresses(ctx, asha))
    expect(book.map((a) => [a.line1, a.isDefault, a.phone])).toEqual([
      ['12 MG Road', true, '9876543210'],
      ['4 Park Street', false, '9876543210'],
    ])

    // Ravi cannot touch Asha's addresses.
    expect(await run(storeId, (ctx) => setDefaultAddress(ctx, ravi, second.id))).toBe(false)
    expect(await run(storeId, (ctx) => deleteAddress(ctx, ravi, second.id))).toBe(false)
    expect(await run(storeId, (ctx) => updateAddress(ctx, ravi, second.id, HOME))).toEqual({
      ok: false,
      errors: { form: 'Address not found' },
    })
    expect(await run(storeId, (ctx) => listAddresses(ctx, ravi))).toEqual([])

    expect(await run(storeId, (ctx) => setDefaultAddress(ctx, asha, second.id))).toBe(true)
    const [snap] = await owner.select().from(customer).where(eq(customer.id, asha))
    expect(snap?.defaultAddress).toMatchObject({ line1: '4 Park Street', pincode: '700016' })

    const edited = await run(storeId, (ctx) =>
      updateAddress(ctx, asha, first.id, {
        ...HOME,
        city: 'Delhi',
        stateCode: 'dl',
        isDefault: true,
      }),
    )
    expect(edited.ok).toBe(true)
    book = await run(storeId, (ctx) => listAddresses(ctx, asha))
    expect(book[0]).toMatchObject({ id: first.id, city: 'Delhi', stateCode: 'DL', isDefault: true })
    expect(book.filter((a) => a.isDefault)).toHaveLength(1)

    // Deleting the default hands it to the remaining address; deleting the last clears it.
    expect(await run(storeId, (ctx) => deleteAddress(ctx, asha, first.id))).toBe(true)
    book = await run(storeId, (ctx) => listAddresses(ctx, asha))
    expect(book).toMatchObject([{ id: second.id, isDefault: true }])
    expect(await run(storeId, (ctx) => deleteAddress(ctx, asha, second.id))).toBe(true)
    const [after] = await owner.select().from(customer).where(eq(customer.id, asha))
    expect(after?.defaultAddress).toBeNull()
  })

  it('validates pincode, state, phone and required fields', async () => {
    const storeId = await makeStore('a')
    const asha = (await signIn(storeId, 'asha@example.com')).customerId
    const r = await run(storeId, (ctx) =>
      createAddress(ctx, asha, {
        ...HOME,
        pincode: '012345',
        stateCode: 'ZZ',
        phone: '12345',
        city: ' ',
      }),
    )
    expect(r).toEqual({
      ok: false,
      errors: {
        pincode: 'Enter a six digit PIN code',
        stateCode: 'Unknown state',
        phone: 'Enter a ten digit mobile number',
        city: 'Required',
      },
    })
    expect(normaliseMobile('09876543210')).toBe('9876543210')
    expect(normaliseMobile('919876543210')).toBe('9876543210')
    expect(normaliseMobile('5876543210')).toBeNull()
    expect(
      await run(storeId, (ctx) =>
        updateAddress(ctx, asha, crypto.randomUUID(), { ...HOME, pincode: 'x' }),
      ),
    ).toMatchObject({ ok: false })
  })

  it('caps the book and remembers checkout addresses once', async () => {
    const storeId = await makeStore('a')
    const asha = (await signIn(storeId, 'asha@example.com')).customerId
    await run(storeId, (ctx) => rememberCheckoutAddress(ctx, asha, HOME))
    await run(storeId, (ctx) =>
      rememberCheckoutAddress(ctx, asha, { ...HOME, line1: '12 mg road' }),
    )
    await run(storeId, (ctx) => rememberCheckoutAddress(ctx, asha, { ...HOME, pincode: 'bad' }))
    expect(await run(storeId, (ctx) => listAddresses(ctx, asha))).toMatchObject([
      { line1: '12 MG Road', isDefault: true },
    ])
    await owner.insert(customerAddress).values(
      Array.from({ length: MAX_ADDRESSES - 1 }, (_, i) => ({
        storeId,
        customerId: asha,
        ...HOME,
        phone: '9876543210',
        line1: `House ${i}`,
      })),
    )
    expect(await run(storeId, (ctx) => createAddress(ctx, asha, HOME))).toEqual({
      ok: false,
      errors: { form: 'Address book is full' },
    })
    await run(storeId, (ctx) => rememberCheckoutAddress(ctx, asha, { ...HOME, line1: 'New' }))
    expect(await run(storeId, (ctx) => listAddresses(ctx, asha))).toHaveLength(MAX_ADDRESSES)
  })
})

describe('profile', () => {
  it('updates name, mobile and consent, tagging a newsletter opt-in', async () => {
    const storeId = await makeStore('a')
    const id = (await signIn(storeId, 'asha@example.com')).customerId
    expect(
      await run(storeId, (ctx) =>
        updateProfile(
          ctx,
          id,
          { name: 'Asha', phone: '98765 43210', acceptsMarketing: true },
          TEST_SECRET,
        ),
      ),
    ).toEqual({ ok: true })
    const [c] = await owner.select().from(customer).where(eq(customer.id, id))
    expect(c).toMatchObject({ name: 'Asha', acceptsMarketing: true, tags: ['newsletter'] })
    expect(decryptCustomerPhone(c?.phone ?? null, TEST_SECRET)).toBe('9876543210')
    expect(
      await run(storeId, (ctx) =>
        updateProfile(ctx, id, { name: '', phone: '', acceptsMarketing: true }, TEST_SECRET),
      ),
    ).toEqual({ ok: true })
    expect(
      await run(storeId, (ctx) =>
        updateProfile(ctx, id, { name: 'A', phone: '12', acceptsMarketing: false }, TEST_SECRET),
      ),
    ).toEqual({ ok: false, errors: { phone: 'Enter a ten digit mobile number' } })
    expect(
      await run(storeId, (ctx) =>
        updateProfile(
          ctx,
          crypto.randomUUID(),
          { name: 'A', phone: '', acceptsMarketing: false },
          TEST_SECRET,
        ),
      ),
    ).toEqual({ ok: false, errors: { form: 'Account not found' } })
  })
})

describe('order history', () => {
  async function seedOrder(
    storeId: string,
    customerId: string | null,
    number: number,
    status = 'open',
  ) {
    const [p] = await owner
      .insert(product)
      .values({ storeId, handle: `p${number}`, title: `Mouse ${number}`, status: 'active' })
      .returning()
    const [v] = await owner
      .insert(variant)
      .values({ storeId, productId: p?.id as string, title: 'Black', pricePaise: 99_900 })
      .returning()
    const [o] = await owner
      .insert(order)
      .values({
        storeId,
        number,
        customerId,
        status: status as 'open',
        subtotalPaise: 199_800,
        totalPaise: 199_800,
        taxPaise: 30_478,
        taxBreakdown: {
          taxPaise: 30_478,
          cgstPaise: 15_239,
          sgstPaise: 15_239,
          igstPaise: 0,
          ratePercent: 18,
          interState: false,
        },
        paymentMethod: 'cod',
        placedAt: new Date(Date.UTC(2026, 8, number)),
      })
      .returning()
    await owner.insert(orderLine).values({
      storeId,
      orderId: o?.id as string,
      variantId: v?.id as string,
      title: `Mouse ${number}`,
      variantTitle: 'Black',
      quantity: 2,
      unitPricePaise: 99_900,
    })
    return { orderId: o?.id as string, variantId: v?.id as string, productId: p?.id as string }
  }

  it('lists only the customer own orders, newest first, with detail and reorder', async () => {
    const storeId = await makeStore('a')
    const asha = (await signIn(storeId, 'asha@example.com')).customerId
    const ravi = (await signIn(storeId, 'ravi@example.com')).customerId
    const one = await seedOrder(storeId, asha, 1)
    await seedOrder(storeId, asha, 2)
    await seedOrder(storeId, asha, 3, 'draft')
    await seedOrder(storeId, ravi, 4)
    await owner.insert(payment).values({
      storeId,
      orderId: one.orderId,
      provider: 'razorpay',
      providerRef: 'r1',
      status: 'captured',
      amountPaise: 199_800,
    })
    await owner.insert(shipment).values({
      storeId,
      orderId: one.orderId,
      provider: 'delhivery',
      waybill: 'AWB1',
      status: 'in_transit',
      tracking: {
        waybill: 'AWB1',
        status: 'in_transit',
        events: [
          { at: '2026-09-02T10:00:00Z', status: 'picked_up', description: 'Picked up' },
          { at: '2026-09-03T10:00:00Z', status: 'in_transit', description: 'At hub' },
        ],
        trackingUrl: 'https://track.example/AWB1',
      },
    })

    await run(storeId, (ctx) => recomputeOrderStatuses(ctx, one.orderId))

    const list = await run(storeId, (ctx) => listCustomerOrders(ctx, asha))
    expect(list.map((o) => [o.number, o.payment, o.shipment, o.itemCount])).toEqual([
      [2, 'cod', 'unfulfilled', 2],
      [1, 'paid', 'in_transit', 2],
    ])
    expect(list.map((o) => [o.status, o.paymentStatus, o.fulfillmentStatus])).toEqual([
      ['open', 'unpaid', 'unfulfilled'],
      // Lines were never packed in this fixture, so the lines win over the courier.
      ['open', 'paid', 'unfulfilled'],
    ])

    const detail = await run(storeId, (ctx) => getCustomerOrder(ctx, asha, 1))
    expect(detail).toMatchObject({
      number: 1,
      gst: { cgstPaise: 15_239, sgstPaise: 15_239 },
      lines: [{ title: 'Mouse 1', linePaise: 199_800, purchasable: true, productHandle: 'p1' }],
      tracking: { waybill: 'AWB1', trackingUrl: 'https://track.example/AWB1' },
    })
    expect(detail?.tracking?.events.map((e) => e.description)).toEqual(['At hub', 'Picked up'])

    // Another customer's order and drafts are invisible.
    expect(await run(storeId, (ctx) => getCustomerOrder(ctx, asha, 4))).toBeNull()
    expect(await run(storeId, (ctx) => getCustomerOrder(ctx, asha, 3))).toBeNull()
    expect(await run(storeId, (ctx) => getCustomerOrder(ctx, asha, 0))).toBeNull()

    expect(await run(storeId, (ctx) => reorderLines(ctx, asha, 1))).toEqual([
      { variantId: one.variantId, quantity: 2 },
    ])
    await owner.update(variant).set({ archivedAt: new Date() }).where(eq(variant.id, one.variantId))
    expect(await run(storeId, (ctx) => reorderLines(ctx, asha, 1))).toEqual([])
    expect(await run(storeId, (ctx) => reorderLines(ctx, ravi, 1))).toEqual([])
  })

  it('names payment states the way a shopper reads them', () => {
    expect(paymentState(undefined, 'cod', false)).toBe('cod')
    expect(paymentState({ provider: 'x', status: 'pending' }, 'x', false)).toBe('pending')
    expect(paymentState({ provider: 'x', status: 'failed' }, 'x', false)).toBe('failed')
    expect(paymentState({ provider: 'x', status: 'captured' }, 'x', true)).toBe('refunded')
  })
})
