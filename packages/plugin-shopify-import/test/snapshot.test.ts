/**
 * Preview snapshots and batched writes: a preview keeps what it read, the
 * import that follows reads that copy plus only what changed, a stale copy
 * means a full read, a failing batch falls back to one record at a time, and
 * week-old copies are cleaned up. A fake Admin API only; never calls Shopify.
 */

import { gunzipSync } from 'node:zlib'
import type { StoreTx } from '@commerce/db'
import {
  customer,
  inventoryLevel,
  order,
  orderLine,
  product,
  storesWithStaleImportSnapshots,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { BulkUnavailableError, streamBulkRoots } from '../src/bulk'
import type { ImportResource, ResourceProgress } from '../src/client'
import { connect } from '../src/connection'
import { executeRun } from '../src/run'
import type { ImportContext } from '../src/runtime'
import { importMapping, importRun } from '../src/schema'
import { createApiRun, startRun } from '../src/service'
import { cleanupSnapshots } from '../src/snapshot'
import type { Issue, NCustomer, NOrder } from '../src/types'
import { writeCustomer, writeCustomers } from '../src/write-customers'
import { writeOrders } from '../src/write-orders'
import { customerNode, fakeShopify, orderNode } from './fixtures/fake-shopify'
import { app, deps, fakeFetch, MemoryStorageProvider, owner, SECRET, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const DAY = 24 * 60 * 60 * 1000
const RESOURCES: ImportResource[] = ['products', 'customers', 'orders']

async function setup(sizes = { customers: 5, orders: 3, products: 2 }, slug = 'shop') {
  const fake = fakeShopify(sizes)
  const fetchImpl = fake.wrap(fakeFetch(fake.graphql))
  const storeId = await seedStore(slug)
  await withStore(app, storeId, (tx) =>
    connect(
      tx,
      storeId,
      { shopDomain: 'waimers.myshopify.com', accessToken: 'shpat_0123456789abcdef' },
      SECRET,
      fetchImpl,
    ),
  )
  const storage = new MemoryStorageProvider()
  const clock = { now: new Date() }
  const d = deps(storeId, storage, {
    fetch: fetchImpl,
    // Bulk polling waits for real (briefly), so an artificial export delay is felt.
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 10))),
    now: () => clock.now,
  })
  const preview = async () => {
    const run = await withStore(app, storeId, (tx) =>
      createApiRun(tx, storeId, { resources: RESOURCES, createdBy: null }),
    )
    await executeRun(d, run.id)
    return run.id
  }
  const importNow = async (runId: string) => {
    await withStore(app, storeId, (tx) => startRun(tx, runId))
    await executeRun(d, runId)
  }
  return { fake, storeId, storage, d, clock, preview, importNow }
}

async function runRow(id: string) {
  const [row] = await owner.select().from(importRun).where(eq(importRun.id, id))
  if (!row) throw new Error('run')
  return row
}

const snapshotKeys = (storage: MemoryStorageProvider) =>
  [...storage.objects.keys()].filter((k) => k.includes('/snapshot/'))

describe('preview snapshot', () => {
  it('keeps what the preview read, per resource, as gzipped JSONL', async () => {
    const { fake, storeId, storage, preview } = await setup()
    const runId = await preview()
    const row = await runRow(runId)
    expect(row.status).toBe('completed')
    expect(row.snapshotTakenAt).not.toBeNull()
    expect(Object.keys(row.snapshot?.streams ?? {}).sort()).toEqual([
      'customers',
      'orders',
      'products',
    ])
    expect(row.snapshot?.streams.orders?.count).toBe(3)
    const key = row.snapshot?.streams.customers?.key as string
    expect(key).toBe(`stores/${storeId}/private/imports/${runId}/snapshot/customers.jsonl.gz`)
    const saved = gunzipSync(storage.objects.get(key)?.body as Uint8Array)
      .toString('utf8')
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l) as NCustomer)
    expect(saved).toHaveLength(5)
    expect(saved[0]).toMatchObject({
      sourceId: 'gid://shopify/Customer/1',
      email: 'shopper1@example.com',
      acceptsMarketing: true,
    })
    expect(fake.calls.filter((c) => c.op.startsWith('bulk:')).map((c) => c.op)).toEqual([
      'bulk:products',
      'bulk:customers',
      'bulk:orders',
    ])
    // Nothing written on a preview.
    expect(await owner.select().from(customer)).toHaveLength(0)
  })

  it('import reuses a fresh snapshot: no full reads, only "changed since"', async () => {
    const { fake, storage, preview, importNow } = await setup()
    const runId = await preview()
    const before = await runRow(runId)
    fake.calls.length = 0

    await importNow(runId)
    const row = await runRow(runId)
    expect(row.status).toBe('completed')
    expect(row.error).toBeNull()
    // No bulk export, no download, and every list query asked only for changes.
    expect(fake.calls.some((c) => c.op.startsWith('bulk:') || c.op.startsWith('download:'))).toBe(
      false,
    )
    const listed = fake.calls.filter((c) => ['Products', 'Customers', 'Orders'].includes(c.op))
    expect(listed.map((c) => c.op).sort()).toEqual(['Customers', 'Orders', 'Products'])
    expect(listed.every((c) => c.search?.startsWith("updated_at:>'"))).toBe(true)
    expect(fake.calls.filter((c) => c.op === 'VariantStock')).toHaveLength(1)

    expect(row.snapshotUse).toEqual({
      takenAt: before.snapshot?.takenAt,
      changes: 0,
      reused: ['products', 'customers', 'orders'],
    })
    expect(row.progress).toMatchObject({
      products: { total: 2, created: 2 },
      customers: { total: 5, created: 5 },
      orders: { total: 3, created: 3 },
    })
    expect(await owner.select().from(customer)).toHaveLength(5)
    expect(await owner.select().from(order)).toHaveLength(3)
    // Lines matched the imported product by SKU, not the placeholder.
    const lines = await owner.select().from(orderLine)
    const [tee] = await owner.select().from(variant).where(eq(variant.sku, 'TEE-1'))
    expect(lines.every((l) => l.variantId === tee?.id)).toBe(true)
    // The copy is deleted once the import has used it.
    expect(row.snapshot).toBeNull()
    expect(row.snapshotTakenAt).toBeNull()
    expect(snapshotKeys(storage)).toEqual([])
  })

  it('reads Shopify in full when the snapshot is over 24 hours old', async () => {
    const { fake, storage, clock, preview, importNow } = await setup()
    const runId = await preview()
    fake.calls.length = 0
    clock.now = new Date(clock.now.getTime() + 25 * 60 * 60 * 1000)

    await importNow(runId)
    const row = await runRow(runId)
    expect(row.status).toBe('completed')
    expect(fake.calls.filter((c) => c.op.startsWith('bulk:')).map((c) => c.op)).toEqual([
      'bulk:products',
      'bulk:customers',
      'bulk:orders',
    ])
    expect(fake.calls.some((c) => c.search !== null)).toBe(false)
    expect(row.snapshotUse).toBeNull()
    expect(row.snapshot).toBeNull()
    expect(snapshotKeys(storage)).toEqual([])
    expect(await owner.select().from(customer)).toHaveLength(5)
  })

  it('merges changes by Shopify id: the changed copy wins, new records are added, stock is fresh', async () => {
    const { fake, preview, importNow } = await setup()
    const runId = await preview()
    const later = new Date(Date.now() + 5000).toISOString()
    fake.data.customers[0] = customerNode(1, { firstName: 'Renamed', updatedAt: later })
    fake.data.customers.push(customerNode(6, { updatedAt: later }))
    fake.data.orders[1] = orderNode(2, 5, { displayFinancialStatus: 'REFUNDED', updatedAt: later })
    // Stock moves without touching the product's update time.
    const tee = fake.data.products[0]?.variants as { nodes: { inventoryQuantity: number }[] }
    ;(tee.nodes[0] as { inventoryQuantity: number }).inventoryQuantity = 3

    await importNow(runId)
    const row = await runRow(runId)
    expect(row.status).toBe('completed')
    expect(row.snapshotUse?.changes).toBe(3)
    expect(row.progress.customers).toMatchObject({ total: 6, created: 6 })
    const shoppers = await owner.select().from(customer)
    expect(shoppers).toHaveLength(6)
    expect(shoppers.find((c) => c.email === 'shopper1@example.com')?.name).toBe('Renamed 1')
    expect(shoppers.some((c) => c.email === 'shopper6@example.com')).toBe(true)
    const [refunded] = await owner.select().from(order).where(eq(order.number, 1002))
    expect(refunded?.paymentStatus).toBe('refunded')
    const [teeVariant] = await owner.select().from(variant).where(eq(variant.sku, 'TEE-1'))
    const [level] = await owner
      .select()
      .from(inventoryLevel)
      .where(eq(inventoryLevel.variantId, teeVariant?.id as string))
    expect(level?.onHand).toBe(3)
  })

  it('re-runs update instead of duplicating, with or without a snapshot', async () => {
    const { preview, importNow } = await setup()
    const first = await preview()
    await importNow(first)
    const counts = async () =>
      Promise.all(
        [customer, order, orderLine, product, variant, importMapping].map(
          async (t) => (await owner.select().from(t)).length,
        ),
      )
    const before = await counts()

    // Run again: the copy is gone, so a full read; everything updates.
    await importNow(first)
    expect(await counts()).toEqual(before)
    expect((await runRow(first)).progress).toMatchObject({
      customers: { created: 0, updated: 5 },
      orders: { created: 0, updated: 3 },
      products: { created: 0, updated: 2 },
    })

    // A new preview and import, reusing the new copy: still no duplicates.
    const second = await preview()
    await importNow(second)
    const row = await runRow(second)
    expect(row.snapshotUse?.reused).toEqual(['products', 'customers', 'orders'])
    expect(await counts()).toEqual(before)
    expect(row.progress).toMatchObject({ customers: { created: 0, updated: 5 } })
  })
})

/** A reporter that keeps counts and issues in memory. */
function stubContext(storeId: string, dryRun = false) {
  const progress: Partial<Record<ImportResource, ResourceProgress>> = {}
  const issues: Issue[] = []
  const of = (r: ImportResource) => {
    progress[r] ??= { total: 0, processed: 0, created: 0, updated: 0, skipped: 0, failed: 0 }
    return progress[r]
  }
  const ctx = {
    storeId,
    runId: 'run-1',
    dryRun,
    inStore: <T>(fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn),
    media: { host: async () => null, urlOf: async () => null },
    report: {
      current: null,
      of,
      begin: of,
      addTotal: () => {},
      count: (r: ImportResource, outcome: 'created' | 'updated' | 'skipped' | 'failed') => {
        of(r).processed++
        of(r)[outcome]++
      },
      sample: () => {},
      leave: () => {},
      issue: (i: Issue) => issues.push(i),
      flush: async () => {},
    },
    log: () => {},
    secret: SECRET,
  } as unknown as ImportContext
  return { ctx, progress, issues }
}

const shopper = (i: number, extra: Partial<NCustomer> = {}): NCustomer => ({
  sourceId: `gid://shopify/Customer/${i}`,
  email: `b${i}@example.com`,
  phone: null,
  firstName: 'B',
  lastName: `${i}`,
  acceptsMarketing: false,
  acceptsSmsMarketing: false,
  tags: [],
  note: null,
  address: null,
  createdAt: null,
  ...extra,
})

describe('batched writes', () => {
  it('falls back to one at a time when a batch fails, with the same per-record problem', async () => {
    const storeId = await seedStore()
    const { ctx, progress, issues } = stubContext(storeId)
    const bad = shopper(3, { createdAt: 'not-a-date' })
    await writeCustomers(ctx, [shopper(1), shopper(2), bad, shopper(4)])
    expect(progress.customers).toMatchObject({ processed: 4, created: 3, failed: 1 })
    expect(await owner.select().from(customer)).toHaveLength(3)
    expect(issues).toHaveLength(1)

    // Exactly what the one-at-a-time writer reports for that record.
    const alone = stubContext(storeId)
    await writeCustomer(alone.ctx, bad)
    expect(issues[0]).toEqual(alone.issues[0])
    expect(issues[0]).toMatchObject({ resource: 'customers', ref: 'b3@example.com' })
  })

  it('writes a clean batch in one go, and a shopper twice in a batch only once', async () => {
    const storeId = await seedStore()
    const { ctx, progress } = stubContext(storeId)
    // Same email as #1 under another Shopify id: matched to the row #1 just created.
    await writeCustomers(ctx, [shopper(1), shopper(2), shopper(5, { email: 'b1@example.com' })])
    expect(progress.customers).toMatchObject({ created: 2, updated: 1, failed: 0 })
    expect(await owner.select().from(customer)).toHaveLength(2)
    const again = stubContext(storeId)
    await writeCustomers(again.ctx, [shopper(1), shopper(2)])
    expect(again.progress.customers).toMatchObject({ created: 0, updated: 2 })
    expect(await owner.select().from(customer)).toHaveLength(2)
  })

  it('rolls back an order batch (and its placeholder item) and retries one by one', async () => {
    const storeId = await seedStore()
    const { ctx, progress, issues } = stubContext(storeId)
    const o = (n: number, extra: Partial<NOrder> = {}): NOrder => ({
      sourceId: `gid://shopify/Order/${n}`,
      name: `#${n}`,
      number: n,
      email: `o${n}@example.com`,
      phone: null,
      customerName: null,
      financialStatus: 'paid',
      fulfillmentStatus: 'fulfilled',
      currency: 'INR',
      subtotalPaise: 1000,
      shippingPaise: 0,
      taxPaise: 0,
      totalPaise: 1000,
      discountCode: null,
      discountPaise: 0,
      refundedPaise: 0,
      paymentMethod: null,
      paymentReference: null,
      createdAt: '2025-01-01T00:00:00Z',
      cancelledAt: null,
      tags: [],
      note: null,
      shippingAddress: null,
      lines: [
        {
          title: 'Gone',
          variantTitle: null,
          sku: null,
          productHandle: null,
          quantity: 1,
          unitPricePaise: 1000,
          fulfilledQuantity: 1,
          taxable: true,
        },
      ],
      ...extra,
    })
    const cache = new Map<string, string>()
    await writeOrders(ctx, [o(1001), o(1002, { createdAt: 'garbage' }), o(1003)], cache)
    expect(progress.orders).toMatchObject({ created: 2, failed: 1 })
    expect(issues.map((i) => i.ref)).toEqual(['#1002'])
    const lines = await owner.select().from(orderLine)
    const placeholder = await owner.select().from(variant)
    expect(lines).toHaveLength(2)
    expect(placeholder).toHaveLength(1)
    expect(lines.every((l) => l.variantId === placeholder[0]?.id)).toBe(true)
  })
})

describe('streaming bulk results', () => {
  async function* lines(rows: Record<string, unknown>[]) {
    for (const r of rows) yield r
  }
  const order = (n: number) => ({ id: `gid://shopify/Order/${n}`, name: `#${n}` })
  const line = (n: number, parent: number) => ({
    id: `gid://shopify/LineItem/${n}`,
    __parentId: `gid://shopify/Order/${parent}`,
  })
  const lineItems = (type: string) =>
    type === 'LineItem' ? { field: 'lineItems', asPage: false } : null

  it('hands on records a batch at a time while the file is still being read', async () => {
    const rows = [order(1), line(11, 1), order(2), order(3), line(31, 3), line(32, 3)]
    const batches: { name: string; lineItems: { nodes: unknown[] } }[][] = []
    for await (const b of streamBulkRoots<{ name: string; lineItems: { nodes: unknown[] } }>(
      lines(rows),
      lineItems,
      [{ field: 'lineItems', asPage: false }],
      2,
    )) {
      batches.push(b)
    }
    expect(batches.map((b) => b.map((o) => [o.name, o.lineItems.nodes.length]))).toEqual([
      [
        ['#1', 1],
        ['#2', 0],
      ],
      [['#3', 2]],
    ])
  })

  it('stops rather than drop a line that arrives after its order was handed on', async () => {
    const rows = [order(1), order(2), line(11, 1)]
    const read = async () => {
      for await (const _ of streamBulkRoots(lines(rows), lineItems)) {
        // drain
      }
    }
    await expect(read()).rejects.toThrow(BulkUnavailableError)
  })

  it('collects child types that share a field (an order’s basic and comment events)', async () => {
    const event = (type: string, n: number) => ({
      id: `gid://shopify/${type}/${n}`,
      __parentId: 'gid://shopify/Order/1',
      message: `${type} ${n}`,
    })
    const rows = [
      order(1),
      line(11, 1),
      event('BasicEvent', 1),
      event('CommentEvent', 2),
      event('BasicEvent', 3),
    ]
    const out: { events: { nodes: { message: string }[] } }[] = []
    for await (const b of streamBulkRoots<{ events: { nodes: { message: string }[] } }>(
      lines(rows),
      (type) =>
        type === 'LineItem'
          ? { field: 'lineItems', asPage: false }
          : type.endsWith('Event')
            ? { field: 'events', asPage: false }
            : null,
    )) {
      out.push(...b)
    }
    expect(out[0]?.events.nodes.map((e) => e.message).sort()).toEqual([
      'BasicEvent 1',
      'BasicEvent 3',
      'CommentEvent 2',
    ])
  })
})

describe('snapshot cleanup', () => {
  it('deletes copies over 7 days old and keeps newer ones', async () => {
    const old = await setup(undefined, 'old-shop')
    old.clock.now = new Date(Date.now() - 8 * DAY)
    const oldRun = await old.preview()
    const recent = await setup(undefined, 'recent-shop')
    recent.clock.now = new Date(Date.now() - 2 * DAY)
    const recentRun = await recent.preview()
    expect(snapshotKeys(old.storage)).toHaveLength(3)

    // The worker's sweep finds only the store with a week-old copy (SECURITY DEFINER, app role).
    const stale = await storesWithStaleImportSnapshots(app, new Date(Date.now() - 7 * DAY))
    expect(stale).toEqual([old.storeId])

    expect(await cleanupSnapshots(old.d)).toBe(1)
    expect(snapshotKeys(old.storage)).toEqual([])
    expect((await runRow(oldRun)).snapshot).toBeNull()
    expect(await cleanupSnapshots(recent.d)).toBe(0)
    expect(snapshotKeys(recent.storage)).toHaveLength(3)
    expect((await runRow(recentRun)).snapshotTakenAt).not.toBeNull()
  })
})
