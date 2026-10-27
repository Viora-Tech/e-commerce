/** SOURCE OF TRUTH: tests for staff-created customers — WHAT: `createCustomer` against a real database: what it writes, what it refuses, the duplicate email and mobile checks / WHY: a customer split in two loses its order history and consent; these pin the dedupe and the writes */
import {
  createDb,
  customer,
  customerAddress,
  marketingConsentEvent,
  outboxEvent,
  type StoreTx,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createCustomer, type NewCustomerInput } from './create'
import { decryptCustomerPhone, phoneBlindIndex } from './phone-crypto'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-only-settings-secret-value'
const actor = { type: 'staff' as const, id: null, label: 'Asha (staff)' }

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function makeStore(slug = 'cu'): Promise<string> {
  const [s] = await owner.insert(store).values({ slug, name: 'Customer Store' }).returning()
  return s?.id as string
}

const create = (storeId: string, input: NewCustomerInput) =>
  inStore(storeId, (tx) => createCustomer({ tx, storeId }, input, { secret: SECRET, actor }))

describe('createCustomer (admin "Add customer")', () => {
  it('saves the customer with an encrypted mobile, tags, note, consent and a default address', async () => {
    const storeId = await makeStore()
    const result = await create(storeId, {
      name: 'Ravi Kumar',
      email: ' Ravi@Example.com ',
      phone: '+919876543210',
      note: 'Met at the Pune stall',
      tags: ['vip', ' VIP ', 'wholesale'],
      consent: { email: true, whatsapp: false },
      address: {
        name: 'Ravi Kumar',
        phone: '+919876543210',
        line1: '12 MG Road',
        city: 'Pune',
        stateCode: 'MH',
        pincode: '411001',
      },
    })
    expect(result.ok).toBe(true)
    const [row] = await owner.select().from(customer)
    expect(row).toMatchObject({
      email: 'ravi@example.com',
      name: 'Ravi Kumar',
      note: 'Met at the Pune stall',
      tags: ['vip', 'wholesale'],
      acceptsMarketing: true,
      acceptsWhatsapp: false,
      phoneIndex: phoneBlindIndex('9876543210', SECRET),
    })
    expect(row?.phone).not.toBe('9876543210')
    expect(decryptCustomerPhone(row?.phone, SECRET)).toBe('9876543210')
    expect(row?.defaultAddress).toMatchObject({ line1: '12 MG Road', pincode: '411001' })
    const book = await owner.select().from(customerAddress)
    expect(book).toHaveLength(1)
    expect(book[0]?.isDefault).toBe(true)
    const consent = await owner.select().from(marketingConsentEvent)
    expect(consent.map((c) => [c.channel, c.granted, c.source])).toEqual([['email', true, 'admin']])
    const events = (await owner.select().from(outboxEvent)).map((e) => e.type)
    expect(events).toContain('customer.created')
    expect(events).toContain('customer.tags_changed')
  })

  it('needs an email or a mobile, and checks them before writing anything', async () => {
    const storeId = await makeStore()
    expect(await create(storeId, { name: 'No contact' })).toMatchObject({
      ok: false,
      reason: 'invalid',
      errors: { email: expect.any(String) },
    })
    expect(await create(storeId, { email: 'not-an-email', phone: '123' })).toMatchObject({
      ok: false,
      reason: 'invalid',
      errors: { email: expect.any(String), phone: expect.any(String) },
    })
    expect(
      await create(storeId, {
        email: 'a@example.com',
        address: {
          name: 'A',
          phone: '9876543210',
          line1: '',
          city: '',
          stateCode: 'XX',
          pincode: '1',
        },
      }),
    ).toMatchObject({ ok: false, reason: 'invalid' })
    expect(await owner.select().from(customer)).toHaveLength(0)
  })

  it('refuses an email or mobile another customer already has, and says who', async () => {
    const storeId = await makeStore()
    const first = await create(storeId, { email: 'asha@example.com', phone: '98765 43210' })
    if (!first.ok) throw new Error('first create failed')
    expect(await create(storeId, { email: 'ASHA@example.com' })).toEqual({
      ok: false,
      reason: 'duplicate',
      field: 'email',
      existingId: first.id,
    })
    expect(await create(storeId, { phone: '+91 98765 43210' })).toEqual({
      ok: false,
      reason: 'duplicate',
      field: 'phone',
      existingId: first.id,
    })
    expect(await owner.select().from(customer)).toHaveLength(1)
  })

  it('finds a checkout customer whose number was never encrypted', async () => {
    const storeId = await makeStore()
    const [old] = await owner
      .insert(customer)
      .values({ storeId, email: null, phone: '+919812345678' })
      .returning()
    expect(await create(storeId, { phone: '9812345678' })).toMatchObject({
      ok: false,
      field: 'phone',
      existingId: old?.id,
    })
  })

  it('keeps stores apart: the same email is fine in another store', async () => {
    const a = await makeStore('a')
    const b = await makeStore('b')
    expect((await create(a, { email: 'same@example.com' })).ok).toBe(true)
    expect((await create(b, { email: 'same@example.com' })).ok).toBe(true)
  })
})
