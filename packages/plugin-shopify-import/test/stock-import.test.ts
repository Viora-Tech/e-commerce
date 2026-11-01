/**
 * Store settings › purchase orders and transfers (audit #75): the writes, against the database.
 * PO #1 from Kyomi lands as ordered with its supplier and incoming stock; a shipped transfer is
 * recorded without moving on-hand stock (it came over with the products). Never calls Shopify.
 */
import { defaultLocationId, saveLocationDetails } from '@commerce/core'
import {
  inventoryLevel,
  newId,
  product,
  purchaseOrder,
  purchaseOrderLine,
  supplier,
  transfer,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { findMapping, saveMapping } from '../src/runtime'
import { importPurchaseOrder, importTransfer } from '../src/settings-import-stock'
import { SETTINGS_MAPPINGS } from '../src/settings-plan'
import type { PurchaseOrderWrite } from '../src/settings-plan-stock'
import { app, owner, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const DELHI = {
  name: 'Delhi store',
  line1: '8 Connaught Place',
  line2: '',
  city: 'New Delhi',
  stateCode: 'DL',
  pincode: '110001',
  country: 'IN',
  phone: '',
}

/** A store with a product of two variants (10 on hand each) and a second location. */
async function seed() {
  const storeId = await seedStore()
  const productId = newId()
  await owner.insert(product).values({ id: productId, storeId, title: 'Mio', handle: 'mio' })
  const black = newId()
  const white = newId()
  await owner.insert(variant).values([
    { id: black, storeId, productId, title: 'Black', sku: 'MIO-BLK', pricePaise: 199900 },
    { id: white, storeId, productId, title: 'White', sku: 'MIO-WHT', pricePaise: 199900 },
  ])
  await owner.insert(inventoryLevel).values([
    { storeId, variantId: black, onHand: 10 },
    { storeId, variantId: white, onHand: 10 },
  ])
  const { home, delhi } = await withStore(app, storeId, async (tx) => ({
    home: await defaultLocationId(tx, storeId),
    delhi: await saveLocationDetails({ tx, storeId }, null, DELHI),
  }))
  return { storeId, black, white, home, delhi }
}

const level = (variantId: string, locationId: string) =>
  owner
    .select()
    .from(inventoryLevel)
    .where(and(eq(inventoryLevel.variantId, variantId), eq(inventoryLevel.locationId, locationId)))
    .then((r) => r[0])

const poWrite = (
  over: Partial<PurchaseOrderWrite> & Pick<PurchaseOrderWrite, 'location' | 'lines'>,
): PurchaseOrderWrite => ({
  sourceId: 'gid://shopify/InventoryPurchaseOrder/1',
  name: '#PO1',
  supplier: { id: null, name: 'Kyomi' },
  currency: 'INR',
  status: 'ordered',
  orderedAt: '2026-10-20T10:00:00Z',
  ...over,
})

describe('purchase orders from Shopify', () => {
  it('saves PO #1 as ordered, adds Kyomi once, and makes the units incoming', async () => {
    const { storeId, black, white, home } = await seed()
    // The Locations part of the same import saved this mapping just before.
    await withStore(app, storeId, (tx) =>
      saveMapping(tx, storeId, SETTINGS_MAPPINGS.locations, 'gid://shopify/Location/1', home),
    )
    await withStore(app, storeId, (tx) =>
      importPurchaseOrder(
        tx,
        storeId,
        poWrite({
          location: { id: null, sourceId: 'gid://shopify/Location/1' },
          lines: [
            { variantId: black, quantity: 50, unitPriceMinor: 100000 },
            { variantId: white, quantity: 15, unitPriceMinor: 100000 },
          ],
        }),
      ),
    )
    const [po] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.storeId, storeId))
    expect(po).toMatchObject({ status: 'ordered', supplierName: 'Kyomi', name: '#PO1' })
    expect(po?.orderedAt?.toISOString()).toBe('2026-10-20T10:00:00.000Z')
    const lines = await owner
      .select()
      .from(purchaseOrderLine)
      .where(eq(purchaseOrderLine.purchaseOrderId, po?.id as string))
    expect(lines.reduce((sum, l) => sum + l.quantity * l.unitPriceMinor, 0)).toBe(6_500_000)
    expect((await level(black, home))?.incoming).toBe(50)
    // On hand is what came over with the products.
    expect((await level(black, home))?.onHand).toBe(10)
    const mapped = await withStore(app, storeId, (tx) =>
      findMapping(tx, SETTINGS_MAPPINGS.purchaseOrders, 'gid://shopify/InventoryPurchaseOrder/1'),
    )
    expect(mapped).toBe(po?.id)

    // A second order from "kyomi " finds the supplier made by the first.
    await withStore(app, storeId, (tx) =>
      importPurchaseOrder(
        tx,
        storeId,
        poWrite({
          sourceId: 'gid://shopify/InventoryPurchaseOrder/3',
          name: '#PO3',
          supplier: { id: null, name: 'kyomi ' },
          status: 'draft',
          orderedAt: null,
          location: { id: home, sourceId: 'gid://shopify/Location/1' },
          lines: [{ variantId: white, quantity: 2, unitPriceMinor: 100000 }],
        }),
      ),
    )
    const suppliers = await owner.select().from(supplier).where(eq(supplier.storeId, storeId))
    expect(suppliers.map((s) => s.name)).toEqual(['Kyomi'])
    // A draft is not incoming yet.
    expect((await level(white, home))?.incoming).toBe(15)
  })

  it('closes an archived order, so nothing stays incoming', async () => {
    const { storeId, black, home } = await seed()
    await withStore(app, storeId, (tx) =>
      importPurchaseOrder(
        tx,
        storeId,
        poWrite({
          status: 'closed',
          location: { id: home, sourceId: null },
          lines: [{ variantId: black, quantity: 4, unitPriceMinor: 5000 }],
        }),
      ),
    )
    const [po] = await owner.select().from(purchaseOrder).where(eq(purchaseOrder.storeId, storeId))
    expect(po?.status).toBe('closed')
    expect((await level(black, home))?.incoming ?? 0).toBe(0)
  })
})

describe('transfers from Shopify', () => {
  it('records #T0001 in transit: incoming at Delhi, on hand untouched', async () => {
    const { storeId, black, home, delhi } = await seed()
    await withStore(app, storeId, (tx) =>
      importTransfer(tx, storeId, {
        sourceId: 'gid://shopify/InventoryTransfer/1',
        from: { id: home, sourceId: 'gid://shopify/Location/1' },
        to: { id: delhi, sourceId: 'gid://shopify/Location/2' },
        status: 'in_transit',
        note: 'Shopify #T0001',
        shippedAt: '2026-10-22T09:00:00Z',
        lines: [{ variantId: black, quantity: 5, unitPriceMinor: 0 }],
      }),
    )
    const [t] = await owner.select().from(transfer).where(eq(transfer.storeId, storeId))
    expect(t).toMatchObject({ status: 'in_transit', fromLocationId: home, toLocationId: delhi })
    expect(t?.shippedAt?.toISOString()).toBe('2026-10-22T09:00:00.000Z')
    expect((await level(black, home))?.onHand).toBe(10)
    expect((await level(black, delhi))?.incoming).toBe(5)
    const mapped = await withStore(app, storeId, (tx) =>
      findMapping(tx, SETTINGS_MAPPINGS.transfers, 'gid://shopify/InventoryTransfer/1'),
    )
    expect(mapped).toBe(t?.id)
  })
})
