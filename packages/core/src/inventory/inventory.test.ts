import {
  createDb,
  inventoryAdjustment,
  inventoryLevel,
  location,
  newId,
  product,
  purchaseOrder,
  purchaseOrderLine,
  sellableLevel,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { deleteProduct } from '../catalog/products'
import { adjustStock, createLocation, defaultLocationId, listLocations, setStock } from './levels'
import {
  closePurchaseOrder,
  deletePurchaseOrder,
  markOrdered,
  savePurchaseOrder,
} from './purchase-orders'
import { receivePurchaseOrder } from './receiving'
import { PurchaseOrderInputSchema, TransferInputSchema } from './schemas'
import { receiveTransfer, saveTransfer, shipTransfer } from './transfers'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seed(opts: { trackInventory?: boolean } = {}) {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  if (!s) throw new Error('seed')
  const productId = newId()
  await owner.insert(product).values({ id: productId, storeId: s.id, title: 'Pad', handle: 'pad' })
  const variantId = newId()
  await owner.insert(variant).values({
    id: variantId,
    storeId: s.id,
    productId,
    title: 'Default',
    pricePaise: 100000,
    trackInventory: opts.trackInventory ?? true,
  })
  // No location named: the trigger must put it on the default location.
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId, onHand: 10 })
  return { storeId: s.id, variantId }
}

const levelAt = (variantId: string, locationId: string) =>
  owner
    .select()
    .from(inventoryLevel)
    .where(and(eq(inventoryLevel.variantId, variantId), eq(inventoryLevel.locationId, locationId)))
    .then((r) => r[0])

describe('locations', () => {
  it('puts legacy inserts on a default location that sells online', async () => {
    const { storeId, variantId } = await seed()
    const locs = await withStore(app, storeId, (tx) => listLocations(tx, storeId))
    expect(locs).toHaveLength(1)
    expect(locs[0]).toMatchObject({ isDefault: true, fulfilsOnlineOrders: true })
    const level = await levelAt(variantId, locs[0]?.id as string)
    expect(level).toMatchObject({ onHand: 10, fulfilsOnline: true })
  })

  it('keeps stock at a second location out of what sells online', async () => {
    const { storeId, variantId } = await seed()
    const warehouse = await withStore(app, storeId, (tx) =>
      createLocation(tx, storeId, { name: 'Warehouse' }),
    )
    expect(warehouse.fulfilsOnlineOrders).toBe(false)
    await withStore(app, storeId, (tx) =>
      adjustStock(tx, {
        storeId,
        variantId,
        locationId: warehouse.id,
        delta: 50,
        reason: 'received',
      }),
    )
    const sellable = await owner
      .select()
      .from(inventoryLevel)
      .where(and(eq(inventoryLevel.variantId, variantId), sellableLevel))
    expect(sellable).toHaveLength(1)
    expect(sellable[0]?.onHand).toBe(10)
  })
})

describe('adjustStock', () => {
  it('refuses to take a tracked variant below zero and logs the location', async () => {
    const { storeId, variantId } = await seed()
    await expect(
      withStore(app, storeId, (tx) =>
        adjustStock(tx, { storeId, variantId, delta: -11, reason: 'damaged' }),
      ),
    ).rejects.toMatchObject({ code: 'NEGATIVE_STOCK' })
    const loc = await withStore(app, storeId, (tx) => defaultLocationId(tx, storeId))
    await withStore(app, storeId, (tx) =>
      setStock(tx, { storeId, variantId, onHand: 4, reason: 'correction', note: 'count' }),
    )
    expect((await levelAt(variantId, loc))?.onHand).toBe(4)
    const [log] = await owner
      .select()
      .from(inventoryAdjustment)
      .where(eq(inventoryAdjustment.variantId, variantId))
    expect(log).toMatchObject({ delta: -6, reason: 'correction', locationId: loc })
  })

  it('lets a variant that sells regardless of stock go negative', async () => {
    const { storeId, variantId } = await seed({ trackInventory: false })
    const next = await withStore(app, storeId, (tx) =>
      adjustStock(tx, { storeId, variantId, delta: -12, reason: 'correction' }),
    )
    expect(next).toBe(-2)
  })
})

describe('purchase orders', () => {
  it('turns ordered units into incoming, then on hand as they are received', async () => {
    const { storeId, variantId } = await seed()
    const loc = await withStore(app, storeId, (tx) => defaultLocationId(tx, storeId))
    const id = await withStore(app, storeId, (tx) =>
      savePurchaseOrder(tx, storeId, {
        supplierName: 'Pulsar',
        locationId: loc,
        currency: 'INR',
        fxRate: '1',
        lines: [{ variantId, quantity: 6, unitPriceMinor: 40000 }],
      }),
    )
    await withStore(app, storeId, (tx) => markOrdered(tx, storeId, id))
    expect((await levelAt(variantId, loc))?.incoming).toBe(6)

    const [line] = await owner
      .select({ id: purchaseOrderLine.id })
      .from(purchaseOrderLine)
      .where(eq(purchaseOrderLine.purchaseOrderId, id))
    const lineId = line?.id as string
    const got = await withStore(app, storeId, (tx) =>
      receivePurchaseOrder(tx, storeId, { id, receipts: [{ lineId, accepted: 4, rejected: 0 }] }),
    )
    expect(got.units).toBe(4)
    let level = await levelAt(variantId, loc)
    expect(level).toMatchObject({ onHand: 14, incoming: 2 })
    let [po] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, id))
    expect(po?.status).toBe('partially_received')

    // Over-receiving is clamped to what is outstanding.
    await withStore(app, storeId, (tx) =>
      receivePurchaseOrder(tx, storeId, { id, receipts: [{ lineId, accepted: 99, rejected: 0 }] }),
    )
    level = await levelAt(variantId, loc)
    expect(level).toMatchObject({ onHand: 16, incoming: 0 })
    ;[po] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, id))
    expect(po?.status).toBe('received')
  })

  it('closing drops what is still incoming, and only drafts can be deleted', async () => {
    const { storeId, variantId } = await seed()
    const loc = await withStore(app, storeId, (tx) => defaultLocationId(tx, storeId))
    const id = await withStore(app, storeId, (tx) =>
      savePurchaseOrder(tx, storeId, {
        supplierName: 'Talongames',
        locationId: loc,
        currency: 'INR',
        fxRate: '1',
        lines: [{ variantId, quantity: 5, unitPriceMinor: 0 }],
      }),
    )
    await withStore(app, storeId, (tx) => markOrdered(tx, storeId, id))
    await expect(
      withStore(app, storeId, (tx) => deletePurchaseOrder(tx, storeId, id)),
    ).rejects.toMatchObject({ code: 'PO_NOT_DRAFT' })
    await withStore(app, storeId, (tx) => closePurchaseOrder(tx, storeId, id))
    expect((await levelAt(variantId, loc))?.incoming).toBe(0)
  })
})

describe('purchase order fixes', () => {
  const base = { supplierName: 'Pulsar', currency: 'INR' as const, fxRate: '1' }

  it('saves and orders in one step when asked', async () => {
    const { storeId, variantId } = await seed()
    const loc = await withStore(app, storeId, (tx) => defaultLocationId(tx, storeId))
    const id = await withStore(app, storeId, (tx) =>
      savePurchaseOrder(tx, storeId, {
        ...base,
        locationId: loc,
        markOrdered: true,
        lines: [{ variantId, quantity: 3, unitPriceMinor: 100 }],
      }),
    )
    const [po] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, id))
    expect(po?.status).toBe('ordered')
    expect((await levelAt(variantId, loc))?.incoming).toBe(3)
  })

  it('leaves no draft behind when ordering fails', async () => {
    const { storeId } = await seed()
    const loc = await withStore(app, storeId, (tx) => defaultLocationId(tx, storeId))
    await expect(
      withStore(app, storeId, (tx) =>
        savePurchaseOrder(tx, storeId, { ...base, locationId: loc, markOrdered: true, lines: [] }),
      ),
    ).rejects.toMatchObject({ code: 'PO_EMPTY' })
    expect(await owner.select().from(purchaseOrder)).toHaveLength(0)
  })

  it('gives concurrent creates distinct numbers', async () => {
    const { storeId, variantId } = await seed()
    const loc = await withStore(app, storeId, (tx) => defaultLocationId(tx, storeId))
    const ids = await Promise.all(
      Array.from({ length: 6 }, () =>
        withStore(app, storeId, (tx) =>
          savePurchaseOrder(tx, storeId, {
            ...base,
            locationId: loc,
            lines: [{ variantId, quantity: 1, unitPriceMinor: 0 }],
          }),
        ),
      ),
    )
    expect(ids).toHaveLength(6)
    const numbers = (await owner.select().from(purchaseOrder)).map((p) => p.number).sort()
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('refuses to change lines or destination once ordered, but takes header edits', async () => {
    const { storeId, variantId } = await seed()
    const loc = await withStore(app, storeId, (tx) => defaultLocationId(tx, storeId))
    const lines = [{ variantId, quantity: 4, unitPriceMinor: 50 }]
    const id = await withStore(app, storeId, (tx) =>
      savePurchaseOrder(tx, storeId, { ...base, locationId: loc, markOrdered: true, lines }),
    )
    await expect(
      withStore(app, storeId, (tx) =>
        savePurchaseOrder(tx, storeId, {
          ...base,
          id,
          locationId: loc,
          lines: [{ variantId, quantity: 9, unitPriceMinor: 50 }],
        }),
      ),
    ).rejects.toMatchObject({ code: 'PO_LINES_LOCKED' })
    await withStore(app, storeId, (tx) =>
      savePurchaseOrder(tx, storeId, {
        ...base,
        id,
        supplierName: 'Renamed',
        locationId: loc,
        lines,
      }),
    )
    const [po] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, id))
    expect(po?.supplierName).toBe('Renamed')
  })

  it('rejects the same product twice', () => {
    const line = { variantId: newId(), quantity: 1, unitPriceMinor: 0 }
    const po = { ...base, locationId: newId(), lines: [line, { ...line, quantity: 2 }] }
    expect(PurchaseOrderInputSchema.safeParse(po).success).toBe(false)
    const t = { fromLocationId: newId(), toLocationId: newId(), lines: [line, line] }
    expect(TransferInputSchema.safeParse(t).success).toBe(false)
  })

  it('will not take another store product or location', async () => {
    const mine = await seed()
    const [other] = await owner.insert(store).values({ slug: 'x', name: 'X' }).returning()
    if (!other) throw new Error('seed')
    const loc = await withStore(app, mine.storeId, (tx) => defaultLocationId(tx, mine.storeId))
    const theirLoc = await withStore(app, other.id, (tx) => defaultLocationId(tx, other.id))
    const productId = newId()
    await owner
      .insert(product)
      .values({ id: productId, storeId: other.id, title: 'Theirs', handle: 'theirs' })
    const theirVariant = newId()
    await owner.insert(variant).values({
      id: theirVariant,
      storeId: other.id,
      productId,
      title: 'Default',
      pricePaise: 1,
    })
    await expect(
      withStore(app, mine.storeId, (tx) =>
        savePurchaseOrder(tx, mine.storeId, {
          ...base,
          locationId: loc,
          lines: [{ variantId: theirVariant, quantity: 1, unitPriceMinor: 0 }],
        }),
      ),
    ).rejects.toMatchObject({ code: 'VARIANT_NOT_FOUND' })
    await expect(
      withStore(app, mine.storeId, (tx) =>
        savePurchaseOrder(tx, mine.storeId, { ...base, locationId: theirLoc, lines: [] }),
      ),
    ).rejects.toMatchObject({ code: 'LOCATION_NOT_FOUND' })
  })

  it('archives a product that is on a purchase order instead of failing', async () => {
    const { storeId, variantId } = await seed()
    const loc = await withStore(app, storeId, (tx) => defaultLocationId(tx, storeId))
    await withStore(app, storeId, (tx) =>
      savePurchaseOrder(tx, storeId, {
        ...base,
        locationId: loc,
        lines: [{ variantId, quantity: 1, unitPriceMinor: 0 }],
      }),
    )
    const [v] = await owner.select().from(variant).where(eq(variant.id, variantId))
    const result = await withStore(app, storeId, (tx) => deleteProduct(tx, v?.productId as string))
    expect(result).toBe('archived')
  })
})

describe('transfers', () => {
  it('ships out of the origin, shows incoming, then lands on hand at the destination', async () => {
    const { storeId, variantId } = await seed()
    const from = await withStore(app, storeId, (tx) => defaultLocationId(tx, storeId))
    const to = (
      await withStore(app, storeId, (tx) => createLocation(tx, storeId, { name: 'Warehouse' }))
    ).id
    const id = await withStore(app, storeId, (tx) =>
      saveTransfer(tx, storeId, {
        fromLocationId: from,
        toLocationId: to,
        lines: [{ variantId, quantity: 3 }],
      }),
    )
    await withStore(app, storeId, (tx) => shipTransfer(tx, storeId, id))
    expect((await levelAt(variantId, from))?.onHand).toBe(7)
    expect((await levelAt(variantId, to))?.incoming).toBe(3)
    await withStore(app, storeId, (tx) => receiveTransfer(tx, storeId, id))
    expect(await levelAt(variantId, to)).toMatchObject({ onHand: 3, incoming: 0 })
  })

  it('will not ship more than the origin holds', async () => {
    const { storeId, variantId } = await seed()
    const from = await withStore(app, storeId, (tx) => defaultLocationId(tx, storeId))
    const to = (
      await withStore(app, storeId, (tx) => createLocation(tx, storeId, { name: 'Shop' }))
    ).id
    const id = await withStore(app, storeId, (tx) =>
      saveTransfer(tx, storeId, {
        fromLocationId: from,
        toLocationId: to,
        lines: [{ variantId, quantity: 11 }],
      }),
    )
    await expect(
      withStore(app, storeId, (tx) => shipTransfer(tx, storeId, id)),
    ).rejects.toMatchObject({ code: 'NEGATIVE_STOCK' })
    const loc = await owner.select().from(location).where(eq(location.id, to))
    expect(loc).toHaveLength(1)
  })
})
