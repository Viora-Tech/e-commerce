import { textPdf } from '@commerce/ai/testing'
import { createMerchantAuth } from '@commerce/auth'
import { createMemoryRateLimitStore } from '@commerce/core'
import {
  createDb,
  inventoryLevel,
  product,
  purchaseCharge,
  purchaseOrderLine,
  role,
  rolePermission,
  store,
  storeMember,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

/*
 * Purchase documents through the router: upload a real PDF, read it with the built-in mock
 * model (AI_PROVIDER=mock, never a real provider), review the proposed matches, apply.
 */

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

const AI_KEYS = ['AI_PROVIDER', 'AI_GATEWAY_API_KEY', 'OPENROUTER_API_KEY'] as const
const savedEnv = Object.fromEntries(AI_KEYS.map((k) => [k, process.env[k]]))

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

const ctx = (headers: Headers, extra: Partial<ApiContext> = {}): ApiContext => ({
  db: app,
  auth,
  headers,
  notifications: { add: async () => undefined },
  rateLimit: createMemoryRateLimitStore(),
  ...extra,
})

async function merchant(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: `Store ${slug}`, organizationId: org?.id as string })
    .returning()
  return { ctx: ctx(headers), storeId: s?.id as string, organizationId: org?.id as string }
}

async function seedVariant(storeId: string, title: string, sku: string) {
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: title.toLowerCase().replace(/\W+/g, '-'), title })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'Default', sku, pricePaise: 100_000 })
    .returning()
  await owner.insert(inventoryLevel).values({ storeId, variantId: v?.id as string, onHand: 0 })
  return v?.id as string
}

const pdf = () =>
  new File(
    [textPdf(['COMMERCIAL INVOICE EX-2026-0042', 'M1-BLK Wireless mouse 98 x 12.40'])],
    'invoice.pdf',
    { type: 'application/pdf' },
  )

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
  for (const k of AI_KEYS) delete process.env[k]
  process.env.AI_PROVIDER = 'mock'
})
afterEach(() => {
  for (const k of AI_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k]
    else process.env[k] = savedEnv[k]
  }
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('purchaseDocuments router', () => {
  it('uploads, reads, proposes matches, applies once and serves the file', async () => {
    const m = await merchant('owner@example.com', 'docs')
    const context = m.ctx
    const mouse = await seedVariant(m.storeId, 'Wireless Mouse', 'M1-BLK')
    const keyboard = await seedVariant(m.storeId, 'Keyboard', 'K2-RED')
    const [loc] = await call(appRouter.inventory.locations, undefined, { context })
    const poId = await call(
      appRouter.purchaseOrders.save,
      {
        supplierName: 'Example Trading',
        locationId: loc?.id as string,
        currency: 'USD',
        fxRate: '80',
        lines: [{ variantId: mouse, quantity: 100, unitPriceMinor: 1250 }],
      },
      { context },
    )

    const up = await call(
      appRouter.purchaseDocuments.upload,
      { purchaseOrderId: poId, kind: 'supplier_invoice', file: pdf() },
      { context },
    )
    expect(up.status).toBe('pending')
    const read = await call(appRouter.purchaseDocuments.read, { id: up.id }, { context })
    expect(read.status).toBe('ready')

    const review = await call(appRouter.purchaseDocuments.review, { id: up.id }, { context })
    expect(review.extracted?.shape).toBe('supplier_invoice')
    // Line 1 by SKU on the order; line 2 by SKU in the store (not on the draft yet).
    expect(review.matches.map((x) => [x.method, x.variantId])).toEqual([
      ['sku', mouse],
      ['sku', keyboard],
    ])
    expect(review.matches[1]?.lineId).toBeNull()
    expect(review.extraVariants.map((v) => v.variantId)).toEqual([keyboard])

    const file = await call(appRouter.purchaseDocuments.download, { id: up.id }, { context })
    expect(file.type).toBe('application/pdf')
    expect(file.name).toBe('invoice.pdf')

    await call(
      appRouter.purchaseDocuments.apply,
      {
        id: up.id,
        currency: 'USD',
        fxRate: '83.25',
        lines: [
          {
            lineId: review.matches[0]?.lineId as string,
            variantId: mouse,
            quantity: 98,
            unitPriceMinor: 1240,
          },
          { variantId: keyboard, quantity: 50, unitPriceMinor: 2800 },
        ],
        charges: [
          {
            kind: 'freight_insurance',
            amountMinor: 4500,
            currency: 'USD',
            fxRate: '83.25',
            gstPaise: 0,
          },
        ],
      },
      { context },
    )
    const lines = await owner
      .select()
      .from(purchaseOrderLine)
      .where(eq(purchaseOrderLine.purchaseOrderId, poId))
    expect(lines.map((l) => [l.variantId, l.quantity]).sort()).toEqual(
      [
        [mouse, 98],
        [keyboard, 50],
      ].sort(),
    )
    expect(await owner.select().from(purchaseCharge)).toHaveLength(1)
    await expect(
      call(appRouter.purchaseDocuments.apply, { id: up.id }, { context }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    const listed = await call(
      appRouter.purchaseDocuments.list,
      { purchaseOrderId: poId },
      { context },
    )
    expect(listed[0]?.status).toBe('applied')
  })

  it('refuses a wrong file type and needs inventory write to upload', async () => {
    const m = await merchant('owner@example.com', 'docs')
    const [loc] = await call(appRouter.inventory.locations, undefined, { context: m.ctx })
    const poId = await call(
      appRouter.purchaseOrders.save,
      { supplierName: 'S', locationId: loc?.id as string, lines: [] },
      { context: m.ctx },
    )
    await expect(
      call(
        appRouter.purchaseDocuments.upload,
        {
          purchaseOrderId: poId,
          kind: 'other',
          file: new File(['<html>'], 'x.html', { type: 'text/html' }),
        },
        { context: m.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })

    // A member on a custom role that may only read inventory.
    const headers = await signIn('helper@example.com')
    const session = await auth.api.getSession({ headers })
    const userId = session?.user.id as string
    await auth.api.addMember({ body: { userId, role: 'member', organizationId: m.organizationId } })
    await auth.api.setActiveOrganization({ headers, body: { organizationId: m.organizationId } })
    await call(appRouter.staff.me, {}, { context: m.ctx })
    const [r] = await owner
      .insert(role)
      .values({ storeId: m.storeId, name: 'Viewer', slug: 'viewer' })
      .returning()
    await owner
      .insert(rolePermission)
      .values({ storeId: m.storeId, roleId: r?.id as string, permission: 'inventory.read' })
    await owner.insert(storeMember).values({ storeId: m.storeId, userId, roleId: r?.id as string })
    await expect(
      call(
        appRouter.purchaseDocuments.upload,
        { purchaseOrderId: poId, kind: 'other', file: pdf() },
        { context: ctx(headers) },
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('queues the read for the worker when a queue is wired, and refuses when AI is off', async () => {
    const m = await merchant('owner@example.com', 'docs')
    const [loc] = await call(appRouter.inventory.locations, undefined, { context: m.ctx })
    const poId = await call(
      appRouter.purchaseOrders.save,
      { supplierName: 'S', locationId: loc?.id as string, lines: [] },
      { context: m.ctx },
    )
    const jobs: unknown[] = []
    const context = {
      ...m.ctx,
      purchaseDocuments: { add: async (_name: string, data: unknown) => jobs.push(data) },
    }
    const up = await call(
      appRouter.purchaseDocuments.upload,
      { purchaseOrderId: poId, kind: 'bill_of_entry', file: pdf() },
      { context },
    )
    const doc = await call(appRouter.purchaseDocuments.read, { id: up.id }, { context })
    expect(doc.status).toBe('pending')
    expect(jobs).toEqual([{ storeId: m.storeId, documentId: up.id }])

    process.env.AI_PROVIDER = 'off'
    await expect(
      call(appRouter.purchaseDocuments.read, { id: up.id }, { context }),
    ).rejects.toMatchObject({ code: 'PRECONDITION_FAILED' })
  })
})
