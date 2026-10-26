/** SOURCE OF TRUTH: tests for the contact phone from an order — WHAT: `suggestContactPhone` and `adoptContactPhone` against a real database: where the number comes from, what is refused, what is written / WHY: issue #810, a customer with a phone only on their order could not be asked for WhatsApp or SMS consent; the copy must be one customer, on a click, encrypted, audited, and never turn consent on */
import {
  address,
  createDb,
  customer,
  customerAddress,
  marketingConsentEvent,
  order,
  outboxEvent,
  privacyAuditEvent,
  type StoreTx,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { adoptContactPhone, suggestContactPhone } from './contact-phone'
import { decryptCustomerPhone, encryptCustomerPhone, phoneBlindIndex } from './phone-crypto'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-only-settings-secret-value'
const actor = { type: 'staff' as const, id: 'user-1', label: 'Asha (staff)' }

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function makeStore(): Promise<string> {
  const [s] = await owner.insert(store).values({ slug: 'cp', name: 'Phone Store' }).returning()
  return s?.id as string
}

async function makeCustomer(storeId: string, values: Partial<typeof customer.$inferInsert> = {}) {
  const [c] = await owner
    .insert(customer)
    .values({ storeId, email: `c${Math.random()}@example.com`, name: 'Rejish', ...values })
    .returning({ id: customer.id })
  return c?.id as string
}

/** An order whose only phone is on its shipping address, like an imported Shopify order. */
async function makeOrder(
  storeId: string,
  customerId: string,
  shipPhone: string,
  opts: { number?: number; phone?: string | null; placedAt?: Date } = {},
) {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Rejish',
      line1: 'VIT, Katpadi',
      city: 'Vellore',
      stateCode: 'TN',
      pincode: '632014',
      phone: shipPhone,
    })
    .returning({ id: address.id })
  await owner.insert(order).values({
    storeId,
    number: opts.number ?? 2332,
    customerId,
    phone: opts.phone ?? null,
    shippingAddressId: a?.id as string,
    subtotalPaise: 59_900,
    totalPaise: 59_900,
    placedAt: opts.placedAt ?? new Date(),
  })
}

const suggest = (storeId: string, id: string) =>
  inStore(storeId, (tx) => suggestContactPhone({ tx, storeId }, id, SECRET))
const adopt = (storeId: string, id: string) =>
  inStore(storeId, (tx) => adoptContactPhone({ tx, storeId }, id, { secret: SECRET, actor }))

describe('suggestContactPhone', () => {
  it('offers the mobile on the latest order’s shipping address, as ten digits', async () => {
    const storeId = await makeStore()
    const id = await makeCustomer(storeId)
    await makeOrder(storeId, id, '+91 98000 00001', { number: 1, placedAt: new Date(2026, 0, 1) })
    await makeOrder(storeId, id, '7904115879', { number: 2, placedAt: new Date(2026, 9, 20) })
    expect(await suggest(storeId, id)).toEqual({
      phone: '7904115879',
      source: 'order',
      takenBy: null,
    })
  })

  it('falls back to the saved address, and offers nothing when the customer has a phone', async () => {
    const storeId = await makeStore()
    const id = await makeCustomer(storeId, {
      defaultAddress: {
        name: 'R',
        line1: 'x',
        city: 'Vellore',
        stateCode: 'TN',
        pincode: '632014',
        phone: '09876543210',
      } as never,
    })
    expect(await suggest(storeId, id)).toMatchObject({ phone: '9876543210', source: 'address' })

    const withPhone = await makeCustomer(storeId, {
      phone: encryptCustomerPhone('9123456780', SECRET).cipher,
      phoneIndex: phoneBlindIndex('9123456780', SECRET),
    })
    await makeOrder(storeId, withPhone, '7904115879')
    expect(await suggest(storeId, withPhone)).toBeNull()
  })

  it('skips numbers that are not a valid mobile', async () => {
    const storeId = await makeStore()
    const id = await makeCustomer(storeId)
    await makeOrder(storeId, id, '12345')
    expect(await suggest(storeId, id)).toBeNull()
  })

  it('says who already has the number', async () => {
    const storeId = await makeStore()
    const other = await makeCustomer(storeId, {
      phone: encryptCustomerPhone('7904115879', SECRET).cipher,
      phoneIndex: phoneBlindIndex('7904115879', SECRET),
    })
    const id = await makeCustomer(storeId)
    await makeOrder(storeId, id, '+917904115879')
    expect(await suggest(storeId, id)).toMatchObject({ phone: '7904115879', takenBy: other })
  })
})

describe('adoptContactPhone', () => {
  it('saves the order’s mobile encrypted and unproven, with an outbox event and an audit entry, and no consent', async () => {
    const storeId = await makeStore()
    const id = await makeCustomer(storeId)
    await makeOrder(storeId, id, '7904115879')
    expect(await adopt(storeId, id)).toEqual({ ok: true, phone: '7904115879', source: 'order' })

    const [row] = await owner.select().from(customer).where(eq(customer.id, id))
    expect(row?.phone).not.toBe('7904115879')
    expect(decryptCustomerPhone(row?.phone, SECRET)).toBe('7904115879')
    expect(row?.phoneIndex).toBe(phoneBlindIndex('7904115879', SECRET))
    expect(row?.phoneVerifiedAt).toBeNull()
    expect(row?.acceptsWhatsapp).toBe(false)
    expect(await owner.select().from(marketingConsentEvent)).toHaveLength(0)

    const events = (await owner.select().from(outboxEvent)).map((e) => e.type)
    expect(events).toContain('customer.updated')
    const audit = await owner.select().from(privacyAuditEvent)
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({
      action: 'contact.phone_added',
      customerId: id,
      actorType: 'staff',
      actorLabel: 'Asha (staff)',
      detail: { field: 'phone', source: 'order' },
    })
    // The audit trail never holds the number itself.
    expect(JSON.stringify(audit[0]?.detail)).not.toContain('7904115879')
  })

  it('refuses a number another customer has, a customer who has a phone, and one with nothing to use', async () => {
    const storeId = await makeStore()
    const other = await makeCustomer(storeId, {
      phone: encryptCustomerPhone('7904115879', SECRET).cipher,
      phoneIndex: phoneBlindIndex('7904115879', SECRET),
    })
    const dup = await makeCustomer(storeId)
    await makeOrder(storeId, dup, '7904115879', { number: 1 })
    expect(await adopt(storeId, dup)).toEqual({ ok: false, reason: 'duplicate', existingId: other })

    expect(await adopt(storeId, other)).toEqual({ ok: false, reason: 'has_phone' })

    const none = await makeCustomer(storeId)
    expect(await adopt(storeId, none)).toEqual({ ok: false, reason: 'none' })

    const book = await makeCustomer(storeId)
    await owner.insert(customerAddress).values({
      storeId,
      customerId: book,
      name: 'B',
      line1: 'x',
      city: 'Pune',
      stateCode: 'MH',
      pincode: '411001',
      phone: '9988776655',
      isDefault: true,
    })
    expect(await adopt(storeId, book)).toEqual({ ok: true, phone: '9988776655', source: 'address' })
    expect(await owner.select().from(privacyAuditEvent)).toHaveLength(1)
  })
})
