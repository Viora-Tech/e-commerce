/** SOURCE OF TRUTH: customer privacy service tests — settings and banner versions, cookie consent proof, data requests and their audit trail (append only), export content, anonymisation that keeps invoice data, consent history and the send-path consent gate */
import {
  address,
  cart,
  cookieConsent,
  createDb,
  customer,
  customerAddress,
  customerOtp,
  customerSession,
  dataRequest,
  marketingConsentEvent,
  marketingMessage,
  newsletterSignup,
  notification,
  order,
  orderLine,
  orderNote,
  privacyAuditEvent,
  product,
  returnRequest,
  type StoreTx,
  shipment,
  shipmentWebhookEvent,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { MarketingSend, NotificationChannel } from '@commerce/notifications'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { phoneLoginOtpKey } from '../accounts/otp'
import {
  confirmNewsletterSignup,
  newsletterConfirmToken,
  requestNewsletterSignup,
} from '../customers/newsletter'
import { encryptCustomerPhone } from '../customers/phone-crypto'
import { sendMarketingEmail, sendMarketingWhatsapp } from '../marketing/send'
import { unsubscribeCustomer } from '../marketing/tracking'
import { anonymiseCustomer } from './anonymise'
import { listPrivacyEvents } from './audit'
import { exportCustomerData } from './export'
import { customerMarketingConsent, setMarketingConsent } from './marketing-consent'
import {
  createDataRequest,
  DataRequestError,
  dataRequestCounts,
  listDataRequests,
  requestAnsweredFor,
  updateDataRequest,
} from './requests'
import {
  askConsentAgain,
  loadCustomerPrivacySettings,
  recordCookieConsent,
  saveCustomerPrivacySettings,
} from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-only-settings-secret-value'
const STAFF = { type: 'staff' as const, id: 'user-1', label: 'Kuldeep' }
const NOW = new Date('2026-09-27T10:00:00Z')

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})
beforeEach(async () => {
  await resetDb(owner)
})

const run = <T>(storeId: string, fn: (ctx: { storeId: string; tx: StoreTx }) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

async function makeStore(slug = 'waimers'): Promise<string> {
  const [s] = await owner.insert(store).values({ slug, name: 'Waimers' }).returning()
  return s?.id as string
}

async function makeCustomer(storeId: string, email = 'asha@example.com') {
  const phone = encryptCustomerPhone('9876543210', SECRET)
  const [c] = await owner
    .insert(customer)
    .values({
      storeId,
      email,
      name: 'Asha Rao',
      phone: phone.cipher,
      phoneIndex: phone.index,
      tags: ['vip'],
      note: 'Prefers evening delivery',
      acceptsMarketing: true,
    })
    .returning()
  return c?.id as string
}

async function makeOrder(storeId: string, customerId: string, placedAt: Date, number: number) {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Asha Rao',
      line1: '12 MG Road',
      city: 'Gurugram',
      stateCode: 'HR',
      pincode: '122001',
      phone: '9876543210',
    })
    .returning()
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: `mouse-${number}`, title: 'Mouse', status: 'active' })
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
      email: 'asha@example.com',
      phone: '9876543210',
      buyerGstin: '06AAACW1234A1Z5',
      buyerBusinessName: 'Asha Traders',
      customerNote: 'Ring twice',
      shippingAddressId: a?.id as string,
      subtotalPaise: 99_900,
      totalPaise: 99_900,
      paymentMethod: 'cod',
      placedAt,
    })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId: v?.id as string,
    title: 'Mouse',
    variantTitle: 'Black',
    quantity: 1,
    unitPricePaise: 99_900,
  })
  return { orderId: o?.id as string, addressId: a?.id as string }
}

describe('customer privacy settings', () => {
  it('saves the window, bumps the banner version only on ask again, and audits both', async () => {
    const storeId = await makeStore()
    await owner
      .update(store)
      .set({
        preferences: { checkout: { email: 'optional' }, policies: { legalName: 'W Pvt Ltd' } },
      })
      .where(eq(store.id, storeId))
    await run(storeId, (ctx) =>
      saveCustomerPrivacySettings(
        ctx,
        { bannerMessage: 'Cookies help', requestDueDays: 15 },
        STAFF,
      ),
    )
    const again = await run(storeId, (ctx) => askConsentAgain(ctx, STAFF))
    expect(again.bannerVersion).toBe(2)
    const settings = await run(storeId, (ctx) => loadCustomerPrivacySettings(ctx))
    expect(settings).toEqual({
      bannerMessage: 'Cookies help',
      bannerVersion: 2,
      requestDueDays: 15,
    })
    const [s] = await owner.select().from(store).where(eq(store.id, storeId))
    // Other preferences are left alone.
    expect(s?.preferences).toMatchObject({
      checkout: { email: 'optional' },
      policies: { legalName: 'W Pvt Ltd' },
    })
    const trail = await run(storeId, (ctx) => listPrivacyEvents(ctx))
    expect(trail.map((e) => e.action)).toEqual(['settings.saved', 'settings.saved'])
    expect(trail[0]?.actorLabel).toBe('Kuldeep')
  })

  it('keeps a proof row per cookie banner answer', async () => {
    const storeId = await makeStore()
    await run(storeId, (ctx) =>
      recordCookieConsent(ctx, {
        analytics: true,
        marketing: false,
        bannerVersion: 1,
        visitorId: 'v-1',
        at: NOW,
      }),
    )
    const rows = await owner.select().from(cookieConsent)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ analytics: true, marketing: false, bannerVersion: 1 })
    expect(rows[0]?.createdAt.toISOString()).toBe(NOW.toISOString())
  })
})

describe('data requests', () => {
  it('opens a request with a due date, dedupes a second ask, and audits every step', async () => {
    const storeId = await makeStore()
    const customerId = await makeCustomer(storeId)
    await run(storeId, (ctx) =>
      saveCustomerPrivacySettings(ctx, { bannerMessage: '', requestDueDays: 10 }, STAFF),
    )
    const first = await run(storeId, (ctx) =>
      createDataRequest(ctx, {
        kind: 'export',
        source: 'account',
        customerId,
        actor: { type: 'customer', id: customerId },
        at: NOW,
      }),
    )
    expect(first.created).toBe(true)
    expect(first.request.number).toBe(1)
    expect(first.request.dueAt.toISOString()).toBe('2026-10-07T10:00:00.000Z')
    const again = await run(storeId, (ctx) =>
      createDataRequest(ctx, { kind: 'export', source: 'account', customerId, actor: STAFF }),
    )
    expect(again).toMatchObject({ created: false, request: { id: first.request.id } })

    const byPhone = await run(storeId, (ctx) =>
      createDataRequest(ctx, {
        kind: 'delete',
        source: 'phone',
        contactPhone: '98765 43210',
        note: 'Called the shop',
        actor: STAFF,
        at: NOW,
      }),
    )
    expect(byPhone.request.number).toBe(2)

    await expect(
      run(storeId, (ctx) =>
        updateDataRequest(ctx, byPhone.request.id, { status: 'rejected' }, STAFF),
      ),
    ).rejects.toThrow(DataRequestError)
    await run(storeId, (ctx) =>
      updateDataRequest(ctx, first.request.id, { status: 'in_progress' }, STAFF),
    )
    await run(storeId, (ctx) =>
      updateDataRequest(ctx, first.request.id, { status: 'completed' }, STAFF),
    )
    await expect(
      run(storeId, (ctx) => updateDataRequest(ctx, first.request.id, { status: 'open' }, STAFF)),
    ).rejects.toThrow('already closed')

    const open = await run(storeId, (ctx) => listDataRequests(ctx, { status: 'open' }))
    expect(open.map((r) => r.number)).toEqual([2])
    const counts = await run(storeId, (ctx) =>
      dataRequestCounts(ctx, new Date('2026-12-01T00:00:00Z')),
    )
    expect(counts).toEqual({ open: 1, overdue: 1 })

    const trail = await run(storeId, (ctx) =>
      listPrivacyEvents(ctx, { dataRequestId: first.request.id }),
    )
    expect(trail.map((e) => [e.action, e.actorType, e.detail])).toEqual([
      ['request.status', 'staff', { from: 'in_progress', to: 'completed' }],
      ['request.status', 'staff', { from: 'open', to: 'in_progress' }],
      ['request.created', 'customer', { kind: 'export', source: 'account', number: 1 }],
    ])
  })

  it("never links another store's customer, nor answers one customer's request for another", async () => {
    const a = await makeStore('a')
    const b = await makeStore('b')
    const mine = await makeCustomer(a, 'x@example.com')
    const other = await makeCustomer(a, 'y@example.com')
    const foreign = await makeCustomer(b, 'z@example.com')
    const req = await run(a, (ctx) =>
      createDataRequest(ctx, { kind: 'delete', source: 'email', actor: STAFF, at: NOW }),
    )
    await expect(
      run(a, (ctx) => updateDataRequest(ctx, req.request.id, { customerId: foreign }, STAFF)),
    ).rejects.toMatchObject({ reason: 'not_found' })
    await run(a, (ctx) => updateDataRequest(ctx, req.request.id, { customerId: other }, STAFF))
    await expect(
      run(a, (ctx) => requestAnsweredFor(ctx, req.request.id, mine)),
    ).rejects.toMatchObject({ reason: 'bad_status' })
    await expect(
      run(b, (ctx) => requestAnsweredFor(ctx, req.request.id, foreign)),
    ).rejects.toMatchObject({ reason: 'not_found' })
  })

  it('keeps the audit trail append only for the app role', async () => {
    const storeId = await makeStore()
    await run(storeId, (ctx) => askConsentAgain(ctx, STAFF))
    await expect(
      run(storeId, (ctx) => ctx.tx.update(privacyAuditEvent).set({ action: 'forged' })),
    ).rejects.toThrow()
    await expect(run(storeId, (ctx) => ctx.tx.delete(privacyAuditEvent))).rejects.toThrow()
    expect(await owner.select().from(privacyAuditEvent)).toHaveLength(1)
  })
})

describe('export', () => {
  it('contains profile, consent, addresses and orders with lines, and is audited without personal data', async () => {
    const storeId = await makeStore()
    const customerId = await makeCustomer(storeId)
    await owner.insert(customerAddress).values({
      storeId,
      customerId,
      name: 'Asha Rao',
      line1: '4 Park Street',
      city: 'Kolkata',
      stateCode: 'WB',
      pincode: '700016',
      phone: '9876543210',
      isDefault: true,
    })
    await makeOrder(storeId, customerId, NOW, 7)
    await run(storeId, (ctx) =>
      setMarketingConsent(ctx, {
        customerId,
        channel: 'whatsapp',
        granted: true,
        source: 'account',
        actor: { type: 'customer', id: customerId },
        at: NOW,
      }),
    )

    const json = await run(storeId, (ctx) =>
      exportCustomerData(ctx, {
        customerId,
        format: 'json',
        secret: SECRET,
        actor: STAFF,
        now: NOW,
      }),
    )
    expect(json?.contentType).toBe('application/json')
    expect(json?.filename).toBe('customer-data-2026-09-27.json')
    const data = JSON.parse(json?.body ?? '{}')
    expect(data.profile).toMatchObject({
      email: 'asha@example.com',
      phone: '9876543210',
      name: 'Asha Rao',
      tags: ['vip'],
    })
    expect(data.marketingConsent).toMatchObject({ email: true, whatsapp: true, sms: false })
    expect(data.marketingConsent.history).toEqual([
      { channel: 'whatsapp', granted: true, source: 'account', at: NOW.toISOString() },
    ])
    expect(data.addresses).toEqual([expect.objectContaining({ city: 'Kolkata', isDefault: true })])
    expect(data.orders).toHaveLength(1)
    expect(data.orders[0]).toMatchObject({
      number: 7,
      gstin: '06AAACW1234A1Z5',
      shippingAddress: expect.objectContaining({ line1: '12 MG Road' }),
      lines: [{ title: 'Mouse', variant: 'Black', quantity: 1, unitPrice: '₹999' }],
    })

    const csv = await run(storeId, (ctx) =>
      exportCustomerData(ctx, {
        customerId,
        format: 'csv',
        secret: SECRET,
        actor: STAFF,
        now: NOW,
      }),
    )
    expect(csv?.contentType).toBe('text/csv')
    expect(csv?.body).toContain('Email,asha@example.com')
    expect(csv?.body).toContain('#7,')

    const trail = await run(storeId, (ctx) => listPrivacyEvents(ctx, { customerId }))
    const exports = trail.filter((e) => e.action === 'export.downloaded')
    expect(exports.map((e) => e.detail?.format)).toEqual(['csv', 'json'])
    expect(JSON.stringify(trail)).not.toContain('asha@example.com')
    expect(JSON.stringify(trail)).not.toContain('9876543210')
  })

  it('returns nothing for a customer of another store', async () => {
    const a = await makeStore('a')
    const b = await makeStore('b')
    const customerId = await makeCustomer(a)
    const file = await run(b, (ctx) =>
      exportCustomerData(ctx, { customerId, format: 'json', secret: SECRET, actor: STAFF }),
    )
    expect(file).toBeNull()
  })
})

describe('anonymise', () => {
  it('erases contact-change notes, message recipients and guest carts too', async () => {
    const storeId = await makeStore()
    const customerId = await makeCustomer(storeId)
    const { orderId } = await makeOrder(storeId, customerId, NOW, 1)
    await owner.insert(orderNote).values([
      { storeId, orderId, body: 'Email changed from asha@example.com to a2@example.com' },
      { storeId, orderId, body: 'Packed with extra bubble wrap' },
    ])
    await owner.insert(notification).values({
      storeId,
      orderId,
      channel: 'email',
      template: 'order_placed',
      to: 'asha@example.com',
    })
    await owner.insert(cart).values({ storeId, email: 'asha@example.com', phone: '9876543210' })
    await run(storeId, (ctx) => anonymiseCustomer(ctx, { customerId, actor: STAFF, now: NOW }))

    const notes = (await owner.select().from(orderNote)).map((n) => n.body).sort()
    expect(notes).toEqual(['Erased', 'Packed with extra bubble wrap'])
    expect((await owner.select().from(notification))[0]?.to).toBe('Erased')
    expect(await owner.select({ email: cart.email, phone: cart.phone }).from(cart)).toEqual([
      { email: null, phone: null },
    ])
  })

  it('erases return photos, courier payloads, phone codes and back-in-stock signups (D-10)', async () => {
    const storeId = await makeStore()
    const customerId = await makeCustomer(storeId)
    const { orderId } = await makeOrder(storeId, customerId, NOW, 1)
    const base = 'https://media.example/'
    const mine = `${base}stores/${storeId}/returns/a1.jpg`
    const missing = `${base}stores/${storeId}/returns/gone.jpg`
    const foreign = 'https://elsewhere.example/x.jpg'
    await owner.insert(returnRequest).values({
      storeId,
      orderId,
      number: 1,
      reason: 'damaged',
      customerNote: 'Box was crushed',
      photos: [mine, missing, foreign],
    })
    await owner.insert(shipment).values({
      storeId,
      orderId,
      provider: 'delhivery',
      waybill: 'AWB1',
      tracking: {
        waybill: 'AWB1',
        status: 'delivered',
        consignee: { name: 'Asha Rao', phone: '9876543210' },
        events: [
          { at: '2026-09-26T10:00:00Z', status: 'delivered', description: 'Delivered to Asha Rao' },
        ],
      },
    })
    await owner.insert(shipmentWebhookEvent).values({
      storeId,
      provider: 'delhivery',
      eventId: 'e1',
      waybill: 'AWB1',
      payload: { waybill: 'AWB1', eventId: 'e1', consignee: 'Asha Rao, 9876543210' },
    })
    const otp = {
      storeId,
      purpose: 'login' as const,
      channel: 'sms' as const,
      codeHash: 'c'.repeat(64),
      expiresAt: new Date(NOW.getTime() + 600_000),
    }
    await owner.insert(customerOtp).values([
      { ...otp, destinationHash: phoneLoginOtpKey(storeId, '9876543210') },
      { ...otp, destinationHash: phoneLoginOtpKey(storeId, '9000000000') },
    ])
    const [p] = await owner.select({ id: product.id }).from(product)
    const [v] = await owner.select({ id: variant.id }).from(variant)
    for (const [i, contact] of [
      { email: 'Asha@Example.com', phone: null },
      { email: null, phone: '919876543210' },
      { email: 'someone@example.com', phone: null },
    ].entries()) {
      await owner.execute(sql`
        insert into back_in_stock_signup (id, store_id, variant_id, product_id, email, phone, status, unsubscribe_token)
        values (gen_random_uuid(), ${storeId}, ${v?.id}, ${p?.id}, ${contact.email}, ${contact.phone},
          ${i === 1 ? 'confirmed' : 'pending_confirmation'}, ${`u${i}`})`)
    }
    const [cu] = await owner.select({ email: customer.email }).from(customer)
    await owner.insert(newsletterSignup).values([
      { storeId, email: cu?.email as string, status: 'confirmed', expiresAt: NOW },
      { storeId, email: 'someone@example.com', status: 'pending', expiresAt: NOW },
    ])
    const deleted: string[] = []
    const storage = {
      publicUrl: (key: string) => `${base}${key}`,
      delete: async (key: string) => {
        if (key.endsWith('gone.jpg')) throw new Error('storage down')
        deleted.push(key)
      },
    }

    const result = await run(storeId, (ctx) =>
      anonymiseCustomer(ctx, { customerId, actor: STAFF, now: NOW, secret: SECRET, storage }),
    )

    // Only this store's returns folder is touched; the rest is counted as not deleted.
    expect(deleted).toEqual([`stores/${storeId}/returns/a1.jpg`])
    expect(result).toMatchObject({ returnPhotosDeleted: 1, returnPhotosFailed: 2 })
    expect(
      await owner
        .select({ photos: returnRequest.photos, note: returnRequest.customerNote })
        .from(returnRequest),
    ).toEqual([{ photos: [], note: null }])
    const [s] = await owner.select({ tracking: shipment.tracking }).from(shipment)
    expect(JSON.stringify(s?.tracking)).not.toMatch(/Asha|9876543210/)
    expect(s?.tracking).toMatchObject({
      waybill: 'AWB1',
      status: 'delivered',
      events: [{ at: '2026-09-26T10:00:00Z', status: 'delivered' }],
    })
    const [w] = await owner
      .select({ payload: shipmentWebhookEvent.payload })
      .from(shipmentWebhookEvent)
    expect(w?.payload).toEqual({ waybill: 'AWB1', eventId: 'e1' })
    // Their phone sign-in code goes; someone else's stays.
    expect(
      (await owner.select({ d: customerOtp.destinationHash }).from(customerOtp)).map((r) => r.d),
    ).toEqual([phoneLoginOtpKey(storeId, '9000000000')])
    const signups = await owner.execute(sql`select email from back_in_stock_signup`)
    expect(signups.map((r) => r.email)).toEqual(['someone@example.com'])
    // Their newsletter signup (the opt-in record) goes; someone else's stays.
    expect(
      (await owner.select({ email: newsletterSignup.email }).from(newsletterSignup)).map(
        (r) => r.email,
      ),
    ).toEqual(['someone@example.com'])
  })

  it('erases personal data and keeps what invoices need', async () => {
    const storeId = await makeStore()
    const customerId = await makeCustomer(storeId)
    await owner.insert(customerAddress).values({
      storeId,
      customerId,
      name: 'Asha Rao',
      line1: '4 Park Street',
      city: 'Kolkata',
      stateCode: 'WB',
      pincode: '700016',
      phone: '9876543210',
    })
    await owner.insert(customerSession).values({
      storeId,
      customerId,
      tokenHash: 'h'.repeat(64),
      expiresAt: new Date(NOW.getTime() + 86_400_000),
    })
    const recent = await makeOrder(storeId, customerId, NOW, 1)
    const ancient = new Date(NOW)
    // Past the eight-year retention period.
    ancient.setUTCFullYear(ancient.getUTCFullYear() - 9)
    const old = await makeOrder(storeId, customerId, ancient, 2)
    // An issued GST invoice (the app's table): a frozen document that must not change.
    await owner.execute(sql`
      insert into invoice (id, store_id, order_id, kind, number, snapshot, buyer_name, buyer_gstin,
        place_of_supply, taxable_paise, cgst_paise, sgst_paise, igst_paise, total_paise)
      values (gen_random_uuid(), ${storeId}, ${recent.orderId}, 'tax_invoice', 'INV-1',
        ${JSON.stringify({ buyer: { name: 'Asha Rao', address: '12 MG Road, Gurugram' } })}::jsonb,
        'Asha Rao', '06AAACW1234A1Z5', '06', 84661, 7620, 7619, 0, 99900)`)
    const [invoiceBefore] = await owner.execute(sql`select * from invoice`)
    const request = await run(storeId, (ctx) =>
      createDataRequest(ctx, {
        kind: 'delete',
        source: 'email',
        customerId,
        contactEmail: 'asha@example.com',
        actor: STAFF,
        at: new Date(NOW.getTime() - 60_000),
      }),
    )

    const result = await run(storeId, (ctx) =>
      anonymiseCustomer(ctx, {
        customerId,
        actor: STAFF,
        dataRequestId: request.request.id,
        now: NOW,
      }),
    )
    expect(result).toEqual({
      customerId,
      ordersKept: 1,
      ordersErased: 1,
      addressesDeleted: 1,
      sessionsEnded: 1,
      returnPhotosDeleted: 0,
      returnPhotosFailed: 0,
    })

    const [cu] = await owner.select().from(customer).where(eq(customer.id, customerId))
    expect(cu).toMatchObject({
      email: null,
      phone: null,
      phoneIndex: null,
      name: null,
      note: null,
      tags: [],
      acceptsMarketing: false,
    })
    expect(cu?.anonymisedAt?.toISOString()).toBe(NOW.toISOString())
    expect(await owner.select().from(customerAddress)).toHaveLength(0)
    expect(await owner.select().from(customerSession)).toHaveLength(0)

    // The recent order keeps its invoice data; contact details are gone.
    const [kept] = await owner.select().from(order).where(eq(order.id, recent.orderId))
    expect(kept).toMatchObject({
      customerId,
      email: null,
      phone: null,
      customerNote: null,
      buyerGstin: '06AAACW1234A1Z5',
      buyerBusinessName: 'Asha Traders',
      totalPaise: 99_900,
    })
    const [keptAddress] = await owner.select().from(address).where(eq(address.id, recent.addressId))
    expect(keptAddress).toMatchObject({
      name: 'Asha Rao',
      line1: '12 MG Road',
      city: 'Gurugram',
      stateCode: 'HR',
      pincode: '122001',
      phone: '',
    })
    expect(await owner.select().from(orderLine)).toHaveLength(2)
    const [invoiceAfter] = await owner.execute(sql`select * from invoice`)
    expect(invoiceAfter).toEqual(invoiceBefore)

    // Past the retention period the order loses the rest too; the state stays for GST reports.
    const [gone] = await owner.select().from(order).where(eq(order.id, old.orderId))
    expect(gone).toMatchObject({ buyerGstin: null, buyerBusinessName: null, totalPaise: 99_900 })
    const [goneAddress] = await owner.select().from(address).where(eq(address.id, old.addressId))
    expect(goneAddress).toMatchObject({ name: 'Erased', line1: 'Erased', stateCode: 'HR' })

    const [req] = await owner.select().from(dataRequest)
    expect(req?.contactEmail).toBeNull()

    const trail = await run(storeId, (ctx) => listPrivacyEvents(ctx, { customerId }))
    expect(trail[0]).toMatchObject({
      action: 'customer.anonymised',
      actorType: 'staff',
      actorLabel: 'Kuldeep',
      dataRequestId: request.request.id,
      detail: expect.objectContaining({ ordersKept: 1, ordersErased: 1 }),
    })

    await expect(
      run(storeId, (ctx) => anonymiseCustomer(ctx, { customerId, actor: STAFF })),
    ).rejects.toThrow('Already erased')
    await expect(
      run(storeId, (ctx) =>
        createDataRequest(ctx, { kind: 'export', source: 'email', customerId, actor: STAFF }),
      ),
    ).rejects.toThrow('already erased')
  })
})

describe('marketing consent', () => {
  it('records every change with its source and ignores no-op saves', async () => {
    const storeId = await makeStore()
    const customerId = await makeCustomer(storeId)
    const change = {
      customerId,
      channel: 'sms' as const,
      granted: true,
      source: 'admin' as const,
      actor: STAFF,
    }
    expect(await run(storeId, (ctx) => setMarketingConsent(ctx, change))).toBe(true)
    expect(await run(storeId, (ctx) => setMarketingConsent(ctx, change))).toBe(false)
    const consent = await run(storeId, (ctx) => customerMarketingConsent(ctx, customerId))
    expect(consent?.channels).toEqual({ email: true, whatsapp: false, sms: true })
    expect(consent?.history).toHaveLength(1)
    // Staff changes are also in the privacy audit trail.
    const trail = await run(storeId, (ctx) => listPrivacyEvents(ctx, { customerId }))
    expect(trail.map((e) => e.action)).toEqual(['consent.changed'])
  })

  it('withdraws every channel on unsubscribe and records a fresh opt in on signup', async () => {
    const storeId = await makeStore()
    const customerId = await makeCustomer(storeId)
    await run(storeId, (ctx) =>
      setMarketingConsent(ctx, {
        customerId,
        channel: 'whatsapp',
        granted: true,
        source: 'account',
        actor: { type: 'customer' },
      }),
    )
    await withStore(app, storeId, (tx) => unsubscribeCustomer(tx, customerId))
    let [cu] = await owner.select().from(customer).where(eq(customer.id, customerId))
    expect(cu).toMatchObject({ acceptsMarketing: false, acceptsWhatsapp: false })
    expect(cu?.unsubscribedAt).not.toBeNull()

    // Signing up again is a fresh opt in once the confirm link is used (double opt-in).
    await withStore(app, storeId, (tx) => requestNewsletterSignup(tx, storeId, 'asha@example.com'))
    ;[cu] = await owner.select().from(customer).where(eq(customer.id, customerId))
    expect(cu?.acceptsMarketing).toBe(false)
    const [signup] = await owner.select().from(newsletterSignup)
    const token = newsletterConfirmToken(signup as typeof newsletterSignup.$inferSelect, SECRET)
    await withStore(app, storeId, (tx) => confirmNewsletterSignup(tx, storeId, token, SECRET))
    ;[cu] = await owner.select().from(customer).where(eq(customer.id, customerId))
    expect(cu).toMatchObject({
      acceptsMarketing: true,
      acceptsWhatsapp: false,
      unsubscribedAt: null,
    })
    const events = await owner
      .select({
        channel: marketingConsentEvent.channel,
        granted: marketingConsentEvent.granted,
        source: marketingConsentEvent.source,
      })
      .from(marketingConsentEvent)
      .orderBy(marketingConsentEvent.createdAt, marketingConsentEvent.id)
    expect(events).toEqual([
      { channel: 'whatsapp', granted: true, source: 'account' },
      { channel: 'email', granted: false, source: 'unsubscribe_link' },
      { channel: 'whatsapp', granted: false, source: 'unsubscribe_link' },
      { channel: 'email', granted: true, source: 'newsletter' },
    ])
  })
})

describe('send path consent gate', () => {
  function fakeChannel(sent: MarketingSend[]): NotificationChannel {
    return {
      id: 'fake',
      label: 'Fake',
      requires: 'email',
      send: async () => ({ ok: true, providerRef: 'x' }),
      sendMarketing: async (m) => {
        sent.push(m)
        return { ok: true, providerRef: `ref-${sent.length}` }
      },
    }
  }

  async function message(storeId: string, customerId: string | null, channel: string) {
    const [m] = await owner
      .insert(marketingMessage)
      .values({ storeId, customerId, channel, to: 'asha@example.com' })
      .returning()
    return m?.id as string
  }

  const deps = {
    registry: undefined as never,
    settingsSecret: SECRET,
    storefrontUrl: 'https://shop.example',
  }
  const sender = { storeName: 'Waimers', storeAddress: undefined }
  const email = (messageId: string, customerId: string | null) => ({
    messageId,
    to: 'asha@example.com',
    customerId,
    subject: 'Sale',
    previewText: '',
    blocks: [],
    merge: {},
    utmCampaign: 'sale',
  })

  it('never calls the provider without consent on that channel', async () => {
    const storeId = await makeStore()
    const customerId = await makeCustomer(storeId)
    const sent: MarketingSend[] = []
    const channel = fakeChannel(sent)

    const ok = await run(storeId, async (ctx) =>
      sendMarketingEmail(
        ctx.tx,
        storeId,
        deps,
        channel,
        sender,
        email(await message(storeId, customerId, 'email'), customerId),
      ),
    )
    expect(ok.ok).toBe(true)
    expect(sent).toHaveLength(1)

    // A bare checkout contact (no customer) and a withdrawn customer get nothing.
    const bare = await message(storeId, null, 'email')
    const r1 = await run(storeId, (ctx) =>
      sendMarketingEmail(ctx.tx, storeId, deps, channel, sender, email(bare, null)),
    )
    await withStore(app, storeId, (tx) => unsubscribeCustomer(tx, customerId))
    const withdrawn = await message(storeId, customerId, 'email')
    const r2 = await run(storeId, (ctx) =>
      sendMarketingEmail(ctx.tx, storeId, deps, channel, sender, email(withdrawn, customerId)),
    )
    expect([r1, r2]).toEqual([
      { ok: false, error: 'no_consent' },
      { ok: false, error: 'no_consent' },
    ])
    expect(sent).toHaveLength(1)
    const rows = await owner.select().from(marketingMessage).where(eq(marketingMessage.id, bare))
    expect(rows[0]).toMatchObject({ status: 'skipped', error: 'no_consent' })

    // WhatsApp needs its own yes; an order update (COD confirmation) needs none.
    const other = await makeCustomer(storeId, 'ravi@example.com')
    const wa = { name: 'offer', language: 'en', variables: [] }
    const r3 = await run(storeId, async (ctx) =>
      sendMarketingWhatsapp(
        ctx.tx,
        channel,
        {
          messageId: await message(storeId, other, 'whatsapp'),
          to: '919876543210',
          customerId: other,
          template: wa,
          merge: {},
        },
        (s) => s,
      ),
    )
    expect(r3).toEqual({ ok: false, error: 'no_consent' })
    const r4 = await run(storeId, async (ctx) =>
      sendMarketingWhatsapp(
        ctx.tx,
        channel,
        {
          messageId: await message(storeId, other, 'whatsapp'),
          to: '919876543210',
          customerId: other,
          transactional: true,
          template: wa,
          merge: {},
        },
        (s) => s,
      ),
    )
    expect(r4.ok).toBe(true)
    expect(sent.map((m) => m.kind)).toEqual(['email', 'whatsapp_template'])
  })
})
