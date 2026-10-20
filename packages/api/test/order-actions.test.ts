import { createMerchantAuth } from '@commerce/auth'
import type { Permission } from '@commerce/core/permissions'
import { address, createDb, order, orderLine, product, store, variant } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { OrderAction } from '@commerce/plugins'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'
import { orderActionGroups } from '../src/services/order-actions.service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const sent: { otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

async function merchant(email: string, slug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({
      slug,
      name: 'Waimers',
      organizationId: org?.id as string,
      gstin: '06AAPFU0939F1ZZ',
      address: { line1: '14 Sector 29', city: 'Gurugram', state: 'HR', pincode: '122001' },
    })
    .returning()
  return {
    ctx: { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext,
    storeId: s?.id as string,
  }
}

async function installGst(storeId: string) {
  await owner
    .update(store)
    .set({ apps: { installed: ['gst-invoices'] } })
    .where(eq(store.id, storeId))
}

async function seedOrder(storeId: string, n: number, opts: { isTest?: boolean } = {}) {
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: `kurta-${n}`, title: 'Kurta' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({
      storeId,
      productId: p?.id as string,
      title: 'M',
      sku: `KRT-${n}`,
      hsCode: '620520',
      pricePaise: 100_000,
    })
    .returning()
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Aarav Mehta',
      line1: 'Carter Road',
      city: 'Mumbai',
      stateCode: 'MH',
      pincode: '400050',
      country: 'IN',
      phone: '9820012345',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: n,
      status: 'open',
      paymentStatus: 'paid',
      checkoutPaidAt: new Date(),
      paymentMethod: 'razorpay',
      shippingAddressId: a?.id,
      subtotalPaise: 200_000,
      shippingPaise: 5_000,
      totalPaise: 205_000,
      email: 'aarav@example.com',
      isTest: opts.isTest ?? false,
    })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId: v?.id as string,
    title: 'Kurta',
    variantTitle: 'M',
    quantity: 2,
    unitPricePaise: 100_000,
    gstRatePercent: 12,
    hsCode: '620520',
  })
  return o?.id as string
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const action = (id: string, extra: Partial<OrderAction> = {}): OrderAction => ({
  id,
  label: { en: id },
  targets: ['detail'],
  handler: { type: 'procedure', procedure: `x/${id}` },
  ...extra,
})

const appState = (id: string, actions: OrderAction[], extra = {}) => ({
  id,
  name: id.toUpperCase(),
  builtIn: false,
  installed: true,
  connected: true,
  admin: { icon: 'Truck', pages: [], orderDetailCard: false, orderActions: actions },
  ...extra,
})

const everything = { can: () => true, enabledProviderIds: new Set(['delhivery']) }

describe('orderActionGroups', () => {
  it('groups by app with its name and icon, and keeps only installed, set-up apps', () => {
    const groups = orderActionGroups(
      [
        appState('gst', [action('a')]),
        appState('off', [action('b')], { installed: false }),
        appState('setup', [action('c')], { connected: false }),
        appState('core', [action('d')], { builtIn: true }),
      ],
      everything,
    )
    expect(groups).toEqual([
      { appId: 'gst', appName: 'GST', icon: 'Truck', actions: [action('a')] },
    ])
  })

  it("drops actions the member's permissions do not cover; unknown permissions grant nothing", () => {
    const writeOnly = (p: Permission) => p === 'orders.write'
    const groups = orderActionGroups(
      [
        appState('gst', [
          action('default'),
          action('fulfil', { permission: 'orders.fulfil' }),
          action('bogus', { permission: 'orders.everything' }),
        ]),
      ],
      { can: writeOnly, enabledProviderIds: new Set() },
    )
    expect(groups[0]?.actions.map((a) => a.id)).toEqual(['default'])
  })

  it("offers a courier's Create shipment only while that courier is switched on", () => {
    const ship = (providerId: string) =>
      action(`ship-${providerId}`, { handler: { type: 'shipment', providerId } })
    const groups = orderActionGroups(
      [appState('delhivery', [ship('delhivery')]), appState('shiprocket', [ship('shiprocket')])],
      everything,
    )
    expect(groups.map((g) => g.appId)).toEqual(['delhivery'])
  })
})

describe('apps.orderActions', () => {
  it('lists the GST invoices actions once the app is installed', async () => {
    const m = await merchant('a@example.com', 'store-a')
    const before = await call(appRouter.apps.orderActions, undefined, { context: m.ctx })
    expect(before.find((g) => g.appId === 'gst-invoices')).toBeUndefined()
    await installGst(m.storeId)
    const after = await call(appRouter.apps.orderActions, undefined, { context: m.ctx })
    const gst = after.find((g) => g.appId === 'gst-invoices')
    expect(gst).toMatchObject({ appName: 'GST invoices', icon: 'FileText' })
    expect(gst?.actions.map((a) => a.id)).toEqual(['generate-invoice', 'add-to-queue'])
  })
})

describe('GST invoices order actions', () => {
  it('generate issues the invoice at once and reports it again on a second click', async () => {
    const m = await merchant('b@example.com', 'store-b')
    await installGst(m.storeId)
    const orderId = await seedOrder(m.storeId, 1)
    const first = await call(appRouter.gstInvoices.generate, { orderId }, { context: m.ctx })
    expect(first.issued).toHaveLength(1)
    expect(first.alreadyIssued).toEqual([])
    const again = await call(appRouter.gstInvoices.generate, { orderId }, { context: m.ctx })
    expect(again).toEqual({ issued: [], alreadyIssued: first.issued })
  })

  it('generate refuses a test order', async () => {
    const m = await merchant('c@example.com', 'store-c')
    await installGst(m.storeId)
    const orderId = await seedOrder(m.storeId, 1, { isTest: true })
    await expect(
      call(appRouter.gstInvoices.generate, { orderId }, { context: m.ctx }),
    ).rejects.toThrow(/test order/)
  })

  it('bulk add skips test orders instead of failing the batch', async () => {
    const m = await merchant('d@example.com', 'store-d')
    await installGst(m.storeId)
    const real = await seedOrder(m.storeId, 1)
    const test = await seedOrder(m.storeId, 2, { isTest: true })
    await expect(
      call(appRouter.gstInvoices.queue.add, { orderIds: [real, test] }, { context: m.ctx }),
    ).rejects.toThrow(/test order/)
    const r = await call(
      appRouter.gstInvoices.queue.add,
      { orderIds: [real, test], skipIneligible: true },
      { context: m.ctx },
    )
    expect(r).toMatchObject({ added: 1, skipped: 1 })
  })

  it('both need the app installed', async () => {
    const m = await merchant('e@example.com', 'store-e')
    const orderId = await seedOrder(m.storeId, 1)
    await expect(
      call(appRouter.gstInvoices.generate, { orderId }, { context: m.ctx }),
    ).rejects.toThrow(/Install the GST invoices app/)
  })
})
