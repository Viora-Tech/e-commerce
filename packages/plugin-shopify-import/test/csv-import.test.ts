import {
  decryptCustomerPhone,
  encryptCustomerPhone,
  findRedirect,
  phoneBlindIndex,
} from '@commerce/core'
import {
  cart,
  customer,
  inventoryLevel,
  media,
  notification,
  order,
  orderLine,
  payment,
  product,
  storeCounter,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { parseCustomersCsv } from '../src/csv-customers'
import { orderNumberFrom, parseOrdersCsv, shopifyDate } from '../src/csv-orders'
import { parseProductsCsv } from '../src/csv-products'
import { executeRun } from '../src/run'
import { importIssue, importMapping, importRun } from '../src/schema'
import { createCsvRun, startRun } from '../src/service'
import { PLACEHOLDER_HANDLE } from '../src/write-orders'
import {
  app,
  deps,
  type FetchLog,
  fakeFetch,
  fakeMediaQueue,
  fixture,
  json,
  MemoryStorageProvider,
  owner,
  SECRET,
  seedStore,
} from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('CSV parsers', () => {
  it('folds a Shopify product export into products with variants, images and HSN', () => {
    const { products, issues } = parseProductsCsv(fixture('products.csv'))
    expect(issues.map((i) => i.message)).toEqual(['The first row for this handle has no title'])
    expect(products).toHaveLength(2)
    const viper = products.find((p) => p.handle === 'viper-mouse')
    expect(viper).toMatchObject({
      title: 'Viper Mouse',
      vendor: 'Waimers',
      productType: 'Mice',
      status: 'active',
      tags: ['gaming', 'mice'],
      optionNames: ['Colour'],
      seoTitle: 'Viper gaming mouse',
    })
    expect(viper?.variants.map((v) => [v.optionValues, v.sku, v.onHand, v.hsCode])).toEqual([
      [['Black'], 'VIP-BLK', 12, '8471'],
      [['White'], 'VIP-WHT', 3, null],
    ])
    expect(viper?.variants[0]).toMatchObject({
      pricePaise: 499900,
      mrpPaise: 599900,
      costPaise: 320000,
      weightGrams: 58,
      barcode: '8901234567890',
      trackInventory: true,
    })
    expect(viper?.images.map((i) => [i.position, i.alt])).toEqual([
      [1, 'Viper front'],
      [2, 'Viper side'],
      [3, 'In the box'],
      [4, null],
      [5, null],
    ])
    const pad = products.find((p) => p.handle === 'glass_pad_pro')
    expect(pad).toMatchObject({ status: 'draft', optionNames: [] })
    expect(pad?.variants[0]).toMatchObject({ trackInventory: false, onHand: 0 })
  })

  it('reads customers with addresses, consent and tags, and skips uncontactable rows', () => {
    const { customers, issues } = parseCustomersCsv(fixture('customers.csv'))
    expect(customers).toHaveLength(2)
    expect(customers[0]).toMatchObject({
      sourceId: '7001',
      email: 'asha@example.com',
      acceptsMarketing: true,
      tags: ['vip', 'repeat'],
      address: { city: 'Bengaluru', provinceCode: 'KA', zip: '560038' },
    })
    expect(issues.map((i) => i.message)).toEqual(['Customer has no email or phone; skipped'])
  })

  it('groups order lines under the order name and reads Shopify dates', () => {
    const { orders } = parseOrdersCsv(fixture('orders.csv'))
    expect(orders.map((o) => [o.name, o.number, o.lines.length])).toEqual([
      ['#1001', 1001, 2],
      ['#1002', 1002, 1],
    ])
    expect(orders[0]).toMatchObject({
      financialStatus: 'paid',
      fulfillmentStatus: 'fulfilled',
      totalPaise: 999800,
      taxPaise: 152512,
      discountCode: 'DIWALI',
      sourceId: '5550001',
      createdAt: '2025-11-02T04:44:00.000Z',
    })
    expect(orders[1]?.cancelledAt).toBe('2025-12-11T04:30:00.000Z')
    expect(orderNumberFrom('WM-1044-IN')).toBe(1044)
    expect(shopifyDate('nonsense')).toBeNull()
  })
})

describe('CSV import: media processing', () => {
  it('queues each hosted image once, nothing on a dry run, and nothing again on a re-run', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const log: FetchLog = []
    const q = fakeMediaQueue()
    const d = deps(storeId, storage, {
      fetch: fakeFetch(unused, log),
      processMedia: q.processMedia(storeId),
    })
    const runId = await csvRun(storeId, storage, 'products', 'products.csv')

    await executeRun(d, runId) // dry run
    expect(log).toHaveLength(0)
    expect(q.adds).toHaveLength(0)

    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(d, runId)
    const hosted = await owner.select().from(media)
    expect(hosted).toHaveLength(5)
    expect(hosted.every((m) => m.status === 'processing')).toBe(true)
    // One add per image, keyed by media id (the scheme `enqueueMediaProcess` uses).
    expect(q.adds.map((a) => a.jobId).sort()).toEqual(hosted.map((m) => m.id).sort())
    expect(q.adds.every((a) => a.data.storeId === storeId && a.jobId === a.data.mediaId)).toBe(true)

    // A second import of the same file: images are already mapped, so no new adds.
    const again = await csvRun(storeId, storage, 'products', 'products.csv')
    await executeRun(d, again)
    await withStore(app, storeId, (tx) => startRun(tx, again))
    await executeRun(d, again)
    expect(q.adds).toHaveLength(5)
    expect(q.jobs.size).toBe(5)
    const issues = await owner.select().from(importIssue).where(eq(importIssue.runId, again))
    expect(issues.filter((i) => i.message.includes('not queued'))).toHaveLength(0)
  })

  it('records a queue failure as an issue and still imports the row', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const q = fakeMediaQueue({ failing: true })
    const d = deps(storeId, storage, {
      fetch: fakeFetch(unused),
      processMedia: q.processMedia(storeId),
    })
    const runId = await csvRun(storeId, storage, 'products', 'products.csv')
    await executeRun(d, runId) // dry run first, as the admin does
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(d, runId)

    const [done] = await owner.select().from(importRun).where(eq(importRun.id, runId))
    expect(done?.status).toBe('completed')
    expect(done?.progress.products).toMatchObject({ created: 2, failed: 0 })
    expect(await owner.select().from(product)).toHaveLength(2)
    // Left `processing`, which is what `bun run media:reprocess` looks for.
    const hosted = await owner.select().from(media)
    expect(hosted.map((m) => m.status)).toEqual(Array(5).fill('processing'))
    const issues = await owner.select().from(importIssue).where(eq(importIssue.runId, runId))
    const queued = issues.filter((i) => i.message.includes('not queued'))
    expect(queued).toHaveLength(5)
    expect(queued.every((i) => i.resource === 'products')).toBe(true)
    expect(queued.map((i) => i.ref)).toContain('https://cdn.shopify.com/s/files/viper-front.png')
    expect(queued[0]?.message).toContain('ECONNREFUSED')
  })

  it('stores video ready without queueing it, as a direct upload does', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const q = fakeMediaQueue()
    const images = fakeFetch(unused)
    const withVideo = (async (input: string | URL | Request, init?: RequestInit) =>
      String(input).endsWith('.mp4')
        ? new Response(new Uint8Array([0, 0, 0, 24]), { headers: { 'content-type': 'video/mp4' } })
        : images(input, init)) as typeof fetch
    const d = deps(storeId, storage, { fetch: withVideo, processMedia: q.processMedia(storeId) })
    const csv = fixture('products.csv').replace(
      'https://cdn.shopify.com/s/files/viper-box.png',
      'https://cdn.shopify.com/s/files/viper-unboxing.mp4',
    )
    const run = await withStore(app, storeId, (tx) =>
      createCsvRun(tx, storeId, storage, {
        resource: 'products',
        fileName: 'products.csv',
        csv,
        createdBy: 'owner@example.com',
      }),
    )
    await executeRun(d, run.id)
    await withStore(app, storeId, (tx) => startRun(tx, run.id))
    await executeRun(d, run.id)

    const hosted = await owner.select().from(media)
    const video = hosted.find((m) => m.contentType === 'video/mp4')
    expect(video?.status).toBe('ready')
    expect(q.adds.map((a) => a.jobId)).not.toContain(video?.id)
    expect(q.adds).toHaveLength(hosted.length - 1)
  })
})

async function csvRun(
  storeId: string,
  storage: MemoryStorageProvider,
  resource: 'products' | 'customers' | 'orders',
  file: string,
) {
  const run = await withStore(app, storeId, (tx) =>
    createCsvRun(tx, storeId, storage, {
      resource,
      fileName: file,
      csv: fixture(file),
      createdBy: 'owner@example.com',
    }),
  )
  return run.id
}

const unused = () => json({})

describe('CSV import runs', () => {
  it('previews without writing, then imports products with re-hosted images, and re-runs idempotently', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const log: FetchLog = []
    const d = deps(storeId, storage, { fetch: fakeFetch(unused, log) })
    const runId = await csvRun(storeId, storage, 'products', 'products.csv')

    await executeRun(d, runId)
    const [preview] = await owner.select().from(importRun).where(eq(importRun.id, runId))
    expect(preview?.status).toBe('completed')
    expect(preview?.progress.products).toMatchObject({ total: 2, created: 2, updated: 0 })
    expect(preview?.preview.map((s) => [s.key, s.action])).toEqual([
      ['viper-mouse', 'create'],
      ['glass_pad_pro', 'create'],
    ])
    expect(await owner.select().from(product)).toHaveLength(0)
    expect(log).toHaveLength(0)
    const previewIssues = await owner.select().from(importIssue).where(eq(importIssue.runId, runId))
    expect(previewIssues).toHaveLength(1)

    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(d, runId)
    const [done] = await owner.select().from(importRun).where(eq(importRun.id, runId))
    expect(done?.status).toBe('completed')
    expect(done?.dryRun).toBe(false)
    expect(done?.progress.products).toMatchObject({ created: 2, failed: 0 })

    const products = await owner.select().from(product).orderBy(asc(product.handle))
    expect(products.map((p) => p.handle)).toEqual(['glass-pad-pro', 'viper-mouse'])
    const variants = await owner.select().from(variant).orderBy(asc(variant.sku))
    expect(variants.map((v) => [v.sku, v.hsCode])).toEqual([
      ['GP-PRO', null],
      ['VIP-BLK', '8471'],
      ['VIP-WHT', null],
    ])
    expect(variants.find((v) => v.sku === 'VIP-BLK')?.mediaId).not.toBeNull()
    const levels = await owner.select().from(inventoryLevel)
    const black = variants.find((v) => v.sku === 'VIP-BLK')
    expect(levels.find((l) => l.variantId === black?.id)?.onHand).toBe(12)

    // Five distinct images on the Viper, each downloaded once and stored in our bucket.
    const hosted = await owner.select().from(media)
    expect(hosted).toHaveLength(5)
    expect(hosted.every((m) => m.url.startsWith('https://media.test/stores/'))).toBe(true)
    expect(storage.objects.size).toBe(6) // five images and the uploaded CSV
    expect(log.filter((l) => l.url.includes('cdn.shopify.com'))).toHaveLength(5)
    expect(hosted.find((m) => m.alt === 'Viper front')).toBeTruthy()

    // The Shopify handle had an underscore; the old URL now 301s to ours.
    const target = await withStore(app, storeId, (tx) =>
      findRedirect(tx, '/products/glass_pad_pro'),
    )
    expect(target).toBe('/products/glass-pad-pro')

    // Again: same products updated in place, no new downloads.
    const again = await csvRun(storeId, storage, 'products', 'products.csv')
    await executeRun(d, again)
    await withStore(app, storeId, (tx) => startRun(tx, again))
    await executeRun(d, again)
    const [second] = await owner.select().from(importRun).where(eq(importRun.id, again))
    expect(second?.progress.products).toMatchObject({ created: 0, updated: 2 })
    expect(await owner.select().from(product)).toHaveLength(2)
    expect(await owner.select().from(variant)).toHaveLength(3)
    expect(await owner.select().from(media)).toHaveLength(5)
    expect(log.filter((l) => l.url.includes('cdn.shopify.com'))).toHaveLength(5)
  })

  it('imports customers, mapping Shopify state codes and matching on email next time', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const d = deps(storeId, storage)
    await owner.insert(customer).values({ storeId, email: 'ravi@example.com', tags: ['wholesale'] })
    const runId = await csvRun(storeId, storage, 'customers', 'customers.csv')
    await executeRun(d, runId)
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(d, runId)
    const rows = await owner.select().from(customer).orderBy(asc(customer.email))
    expect(rows).toHaveLength(2)
    const asha = rows.find((c) => c.email === 'asha@example.com')
    expect(asha).toMatchObject({
      name: 'Asha Rao',
      acceptsMarketing: true,
      note: 'Prefers courier',
    })
    expect(asha?.defaultAddress).toMatchObject({
      stateCode: 'KA',
      pincode: '560038',
      country: 'IN',
    })
    const ravi = rows.find((c) => c.email === 'ravi@example.com')
    expect(ravi?.defaultAddress?.stateCode).toBe('CG')
    expect(ravi?.tags).toEqual(['wholesale'])
    expect(ravi?.defaultAddress?.line1).toBe('Kumar Traders, 4 Station Rd')

    const [run] = await owner.select().from(importRun).where(eq(importRun.id, runId))
    expect(run?.progress.customers).toMatchObject({ created: 1, updated: 1 })
  })

  it('matches an existing customer by phone via the blind index, and keeps the phone encrypted', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const d = deps(storeId, storage)
    // No email, so matchCustomer falls through to the phone lookup — this must hit
    // `customer.phone_index`, never `eq(customer.phone, ...)`, since the stored phone is
    // already ciphertext (as the admin/checkout paths leave it).
    const { cipher, index } = encryptCustomerPhone('+919800000001', SECRET)
    const [existing] = await owner
      .insert(customer)
      .values({ storeId, phone: cipher, phoneIndex: index, note: 'Called about a return' })
      .returning()
    const runId = await csvRun(storeId, storage, 'customers', 'customers.csv')
    await executeRun(d, runId)
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(d, runId)

    const rows = await owner.select().from(customer)
    // Matched, not duplicated: still one row for that phone, not two.
    expect(rows.filter((c) => c.phoneIndex === index)).toHaveLength(1)
    const asha = rows.find((c) => c.id === existing?.id)
    expect(asha).toBeDefined()
    // The import's own values (name, address) landed on the matched row.
    expect(asha).toMatchObject({ name: 'Asha Rao', note: 'Prefers courier' })
    // The phone stayed encrypted under the current key, not overwritten with plaintext.
    expect(asha?.phone?.startsWith('v2.')).toBe(true)
    expect(decryptCustomerPhone(asha?.phone ?? null, SECRET)).toBe('+919800000001')
    expect(phoneBlindIndex('+919800000001', SECRET)).toBe(index)

    const [run] = await owner.select().from(importRun).where(eq(importRun.id, runId))
    expect(run?.progress.customers).toMatchObject({ created: 1, updated: 1 })
  })

  it('imports historical orders read-only: no stock, no messages, counters move on', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const d = deps(storeId, storage, { fetch: fakeFetch(unused) })
    const productRun = await csvRun(storeId, storage, 'products', 'products.csv')
    await executeRun(d, productRun)
    await withStore(app, storeId, (tx) => startRun(tx, productRun))
    await executeRun(d, productRun)
    const stockBefore = await owner.select().from(inventoryLevel).orderBy(asc(inventoryLevel.id))

    const runId = await csvRun(storeId, storage, 'orders', 'orders.csv')
    await executeRun(d, runId)
    expect(await owner.select().from(order)).toHaveLength(0)
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(d, runId)

    const orders = await owner.select().from(order).orderBy(asc(order.number))
    expect(
      orders.map((o) => [o.number, o.status, o.paymentStatus, o.fulfillmentStatus, o.importedFrom]),
    ).toEqual([
      [1001, 'completed', 'paid', 'fulfilled', 'shopify'],
      [1002, 'cancelled', 'refunded', 'unfulfilled', 'shopify'],
    ])
    expect(orders[0]?.importMeta).toMatchObject({ name: '#1001', financialStatus: 'paid' })
    expect(orders[0]?.placedAt.toISOString()).toBe('2025-11-02T04:44:00.000Z')

    const lines = await owner
      .select()
      .from(orderLine)
      .where(eq(orderLine.orderId, orders[0]?.id as string))
    const [blackVariant] = await owner.select().from(variant).where(eq(variant.sku, 'VIP-BLK'))
    expect(lines.find((l) => l.title === 'Viper Mouse - Black')?.variantId).toBe(blackVariant?.id)
    expect(lines.every((l) => l.fulfilledQuantity === l.quantity)).toBe(true)
    const [placeholder] = await owner
      .select()
      .from(product)
      .where(eq(product.handle, PLACEHOLDER_HANDLE))
    expect(placeholder?.status).toBe('archived')

    const payments = await owner.select().from(payment)
    expect(payments.map((p) => [p.provider, p.status, p.amountPaise])).toEqual([
      ['shopify', 'captured', 999800],
      ['shopify', 'refunded', 259800],
    ])
    const [buyer] = await owner
      .select()
      .from(customer)
      .where(eq(customer.email, 'new.buyer@example.com'))
    expect(orders[1]?.customerId).toBe(buyer?.id)

    // Nothing moved: stock, notifications; new orders continue after #1002.
    expect(await owner.select().from(inventoryLevel).orderBy(asc(inventoryLevel.id))).toEqual(
      stockBefore,
    )
    expect(await owner.select().from(notification)).toHaveLength(0)
    // The counter (`store_counter`, 0177) moved past the imported numbers.
    const [n] = await owner.select().from(storeCounter).where(eq(storeCounter.storeId, storeId))
    expect(n?.value).toBe(1003)

    // Re-running updates in place.
    const again = await csvRun(storeId, storage, 'orders', 'orders.csv')
    await executeRun(d, again)
    await withStore(app, storeId, (tx) => startRun(tx, again))
    await executeRun(d, again)
    expect(await owner.select().from(order)).toHaveLength(2)
    expect(await owner.select().from(orderLine)).toHaveLength(3)
    expect(await owner.select().from(payment)).toHaveLength(2)
    const mapped = await owner
      .select()
      .from(importMapping)
      .where(eq(importMapping.resource, 'orders'))
    expect(mapped).toHaveLength(2)
  })

  it('never overwrites an order placed in this store that shares a number', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    await owner
      .insert(order)
      .values({ storeId, number: 1001, subtotalPaise: 100, totalPaise: 100, status: 'open' })
    const runId = await csvRun(storeId, storage, 'orders', 'orders.csv')
    await executeRun(deps(storeId, storage), runId)
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(deps(storeId, storage), runId)
    const orders = await owner.select().from(order).orderBy(asc(order.number))
    expect(orders.map((o) => [o.number, o.importedFrom])).toEqual([
      [1001, null],
      [1002, 'shopify'],
    ])
    const issues = await owner.select().from(importIssue).where(eq(importIssue.runId, runId))
    expect(issues.some((i) => i.ref === '#1001' && /already belongs/.test(i.message))).toBe(true)
  })

  it("moves an abandoned checkout off a number Shopify's real order needs", async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const [c] = await owner.insert(cart).values({ storeId }).returning()
    await owner.insert(order).values({
      storeId,
      number: 1001,
      subtotalPaise: 100,
      totalPaise: 100,
      status: 'cancelled',
      paymentMethod: 'razorpay',
      cartId: c?.id,
    })
    const runId = await csvRun(storeId, storage, 'orders', 'orders.csv')
    await executeRun(deps(storeId, storage), runId)
    const [previewed] = await owner.select().from(order)
    expect(previewed?.number).toBe(1001)
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(deps(storeId, storage), runId)
    const orders = await owner.select().from(order).orderBy(asc(order.number))
    const imported = orders.filter((o) => o.importedFrom === 'shopify').map((o) => o.number)
    expect(imported).toEqual([1001, 1002])
    const moved = orders.find((o) => o.importedFrom === null)
    expect([1001, 1002]).not.toContain(moved?.number)
    expect(new Set(orders.map((o) => o.number)).size).toBe(orders.length)
  })

  it("moves a cancelled local order off a number Shopify's real order needs", async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    await owner.insert(order).values({
      storeId,
      number: 1001,
      subtotalPaise: 100,
      totalPaise: 100,
      status: 'cancelled',
      paymentMethod: 'manual',
    })
    const runId = await csvRun(storeId, storage, 'orders', 'orders.csv')
    await executeRun(deps(storeId, storage), runId)
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(deps(storeId, storage), runId)
    const orders = await owner.select().from(order).orderBy(asc(order.number))
    const imported = orders.filter((o) => o.importedFrom === 'shopify').map((o) => o.number)
    expect(imported).toEqual([1001, 1002])
    const moved = orders.find((o) => o.importedFrom === null)
    expect([1001, 1002]).not.toContain(moved?.number)
    expect(new Set(orders.map((o) => o.number)).size).toBe(orders.length)
    const issues = await owner.select().from(importIssue).where(eq(importIssue.runId, runId))
    expect(issues.some((i) => /already belongs/.test(i.message))).toBe(false)
  })

  it('moves only the number of a cancelled paid local order, never its payments', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const [local] = await owner
      .insert(order)
      .values({
        storeId,
        number: 1001,
        subtotalPaise: 100,
        totalPaise: 100,
        status: 'cancelled',
        paymentStatus: 'paid',
        paymentMethod: 'razorpay',
        checkoutPaidAt: new Date('2026-11-01T10:00:00Z'),
      })
      .returning()
    if (!local) throw new Error('seed')
    const [paid] = await owner
      .insert(payment)
      .values({
        storeId,
        orderId: local.id,
        provider: 'razorpay',
        providerRef: 'pay_local',
        status: 'captured',
        amountPaise: 100,
      })
      .returning()
    const runId = await csvRun(storeId, storage, 'orders', 'orders.csv')
    await executeRun(deps(storeId, storage), runId)
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(deps(storeId, storage), runId)
    const [after] = await owner.select().from(order).where(eq(order.id, local.id))
    expect(after).toEqual({ ...local, number: after?.number, updatedAt: after?.updatedAt })
    expect([1001, 1002]).not.toContain(after?.number)
    expect(await owner.select().from(payment).where(eq(payment.orderId, local.id))).toEqual([paid])
  })

  it('leaves an open direct UPI order on its number and skips the Shopify order', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    await owner.insert(order).values({
      storeId,
      number: 1001,
      subtotalPaise: 100,
      totalPaise: 100,
      status: 'open',
      paymentMethod: 'manual',
    })
    const runId = await csvRun(storeId, storage, 'orders', 'orders.csv')
    await executeRun(deps(storeId, storage), runId)
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(deps(storeId, storage), runId)
    const orders = await owner.select().from(order).orderBy(asc(order.number))
    expect(orders.map((o) => [o.number, o.importedFrom, o.totalPaise])).toEqual([
      [1001, null, 100],
      [1002, 'shopify', 259800],
    ])
    const issues = await owner.select().from(importIssue).where(eq(importIssue.runId, runId))
    expect(issues.some((i) => i.ref === '#1001' && /already belongs/.test(i.message))).toBe(true)
  })

  it('updates a cancelled order that came from Shopify in place, keeping its number', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const [earlier] = await owner
      .insert(order)
      .values({
        storeId,
        number: 1001,
        subtotalPaise: 100,
        totalPaise: 100,
        status: 'cancelled',
        importedFrom: 'shopify',
      })
      .returning()
    const runId = await csvRun(storeId, storage, 'orders', 'orders.csv')
    await executeRun(deps(storeId, storage), runId)
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(deps(storeId, storage), runId)
    const orders = await owner.select().from(order).orderBy(asc(order.number))
    expect(orders.map((o) => [o.number, o.importedFrom])).toEqual([
      [1001, 'shopify'],
      [1002, 'shopify'],
    ])
    expect(orders[0]?.id).toBe(earlier?.id)
  })

  it('finds an order already mapped to the Shopify order before any number clash', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const [mapped] = await owner
      .insert(order)
      .values({
        storeId,
        number: 1001,
        subtotalPaise: 100,
        totalPaise: 100,
        status: 'cancelled',
      })
      .returning()
    if (!mapped) throw new Error('seed')
    await owner
      .insert(importMapping)
      .values({ storeId, resource: 'orders', sourceId: '5550001', localId: mapped.id })
    const runId = await csvRun(storeId, storage, 'orders', 'orders.csv')
    await executeRun(deps(storeId, storage), runId)
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(deps(storeId, storage), runId)
    const orders = await owner.select().from(order).orderBy(asc(order.number))
    expect(orders.map((o) => [o.number, o.importedFrom])).toEqual([
      [1001, null],
      [1002, 'shopify'],
    ])
  })

  it('moves nothing on a dry run and reports the real order as new', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const [local] = await owner
      .insert(order)
      .values({
        storeId,
        number: 1001,
        subtotalPaise: 100,
        totalPaise: 100,
        status: 'cancelled',
        paymentMethod: 'cod',
      })
      .returning()
    const counterBefore = await owner.select().from(storeCounter)
    const runId = await csvRun(storeId, storage, 'orders', 'orders.csv')
    await executeRun(deps(storeId, storage), runId)
    expect(await owner.select().from(order)).toEqual([local])
    expect(await owner.select().from(storeCounter)).toEqual(counterBefore)
    const [run] = await owner.select().from(importRun).where(eq(importRun.id, runId))
    expect(run?.dryRun).toBe(true)
    const issues = await owner.select().from(importIssue).where(eq(importIssue.runId, runId))
    expect(issues.some((i) => /already belongs/.test(i.message))).toBe(false)
    expect(run?.preview.find((s) => s.key === '#1001')?.action).toBe('create')
  })

  it('fails the run with a reason when the file is gone', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const runId = await csvRun(storeId, storage, 'products', 'products.csv')
    storage.objects.clear()
    await executeRun(deps(storeId, storage), runId)
    const [run] = await owner.select().from(importRun).where(eq(importRun.id, runId))
    expect(run?.status).toBe('failed')
    expect(run?.error).toMatch(/no longer available/)
  })
})
