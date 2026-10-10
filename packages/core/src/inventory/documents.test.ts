/** SOURCE OF TRUTH: tests for purchase documents on real rows: upload, AI read, apply, reset */
import { MOCK_DOCUMENTS } from '@commerce/ai'
import { textPdf } from '@commerce/ai/testing'
import {
  createDb,
  inboundShipment,
  inventoryLevel,
  newId,
  product,
  purchaseCharge,
  purchaseChargeSplit,
  purchaseDocument,
  purchaseOrder,
  purchaseOrderLine,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { asc, eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readPurchaseDocument } from '../ai/document-read'
import { applyPurchaseDocument } from './document-apply'
import {
  type DocumentOwner,
  deletePurchaseDocument,
  documentStorage,
  listPurchaseDocuments,
  loadPurchaseDocument,
  purchaseDocumentFile,
  queuePurchaseDocumentRead,
  resetPurchaseDocument,
  uploadPurchaseDocument,
} from './documents'
import { attachPurchaseOrder, saveInboundShipment } from './inbound-shipments'
import { defaultLocationId } from './levels'
import { savePurchaseOrder } from './purchase-orders'
import type { ApplyDocument, PurchaseOrderInput } from './schemas'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const AI_KEYS = ['AI_PROVIDER', 'AI_GATEWAY_API_KEY', 'OPENROUTER_API_KEY'] as const
const savedEnv = Object.fromEntries(AI_KEYS.map((k) => [k, process.env[k]]))

beforeEach(async () => {
  await resetDb(owner)
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

async function seedStore(slug = 'docs') {
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const productId = newId()
  await owner
    .insert(product)
    .values({ id: productId, storeId: s.id, title: 'Desk gear', handle: `gear-${slug}` })
  const addVariant = async (title: string, sku: string | null) => {
    const id = newId()
    await owner.insert(variant).values({
      id,
      storeId: s.id,
      productId,
      title,
      sku,
      pricePaise: 500_000,
      weightGrams: 500,
    })
    await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: id, onHand: 0 })
    return id
  }
  const loc = await withStore(app, s.id, (tx) => defaultLocationId(tx, s.id))
  return { storeId: s.id, loc, addVariant }
}

type Ctx = Awaited<ReturnType<typeof seedStore>>

const run = <T>(c: Ctx, fn: (tx: StoreTx) => Promise<T>) => withStore(app, c.storeId, fn)

const order = (
  c: Ctx,
  lines: PurchaseOrderInput['lines'],
  over: Partial<PurchaseOrderInput> = {},
) =>
  run(c, (tx) =>
    savePurchaseOrder(tx, c.storeId, {
      supplierName: 'Example Trading',
      locationId: c.loc,
      currency: 'USD',
      fxRate: '80',
      lines,
      ...over,
    }),
  )

const PDF = { name: 'invoice.pdf', type: 'application/pdf' }

const upload = (c: Ctx, docOwner: DocumentOwner, kind = 'supplier_invoice' as const) =>
  run(c, (tx) =>
    uploadPurchaseDocument(tx, c.storeId, {
      owner: docOwner,
      kind,
      file: { ...PDF, bytes: textPdf(['COMMERCIAL INVOICE EX-2026-0042', 'M1-BLK 98 12.40']) },
      userId: 'user-1',
    }),
  )

/** A document marked as read with the mock's answer for its shape, without calling a model. */
async function readyDocument(
  c: Ctx,
  docOwner: DocumentOwner,
  kind: 'supplier_invoice' | 'bill_of_entry' | 'freight_bill',
) {
  const doc = await upload(c, docOwner, kind as 'supplier_invoice')
  const shape = kind === 'freight_bill' ? 'service_bill' : kind
  await owner
    .update(purchaseDocument)
    .set({ status: 'ready', extracted: { shape, data: MOCK_DOCUMENTS[shape] } })
    .where(eq(purchaseDocument.id, doc.id))
  return doc.id
}

const apply = (c: Ctx, input: Omit<ApplyDocument, 'lines' | 'charges'> & Partial<ApplyDocument>) =>
  run(c, (tx) =>
    applyPurchaseDocument(tx, c.storeId, { lines: [], charges: [], ...input }, 'user-1'),
  )

const linesOf = (poId: string) =>
  owner
    .select()
    .from(purchaseOrderLine)
    .where(eq(purchaseOrderLine.purchaseOrderId, poId))
    .orderBy(asc(purchaseOrderLine.id))

const poRow = async (id: string) =>
  (await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, id)))[0]

const docRow = async (id: string) =>
  (await owner.select().from(purchaseDocument).where(eq(purchaseDocument.id, id)))[0]

describe('uploading a purchase document', () => {
  it('stores the file privately and lists it on its order', async () => {
    const c = await seedStore()
    const v = await c.addVariant('Black', 'M1-BLK')
    const po = await order(c, [{ variantId: v, quantity: 100, unitPriceMinor: 1250 }])
    const doc = await upload(c, { purchaseOrderId: po })

    expect(doc).toMatchObject({
      status: 'pending',
      mimeType: 'application/pdf',
      kind: 'supplier_invoice',
    })
    expect(doc.fileKey).toMatch(new RegExp(`^stores/${c.storeId}/private/purchase-documents/`))
    const listed = await run(c, (tx) => listPurchaseDocuments(tx, { purchaseOrderId: po }))
    expect(listed.map((d) => d.id)).toEqual([doc.id])
    const file = await run(c, (tx) => purchaseDocumentFile(tx, c.storeId, doc.id))
    expect(file).toMatchObject({ name: 'invoice.pdf', type: 'application/pdf' })
    expect(new TextDecoder().decode(file.bytes.slice(0, 8))).toBe('%PDF-1.4')
  })

  it('refuses other file types, empty or oversized files, and another store’s order', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const po = await order(a, [])
    const send = (c: Ctx, type: string, size: number, poId = po) =>
      run(c, (tx) =>
        uploadPurchaseDocument(tx, c.storeId, {
          owner: { purchaseOrderId: poId },
          kind: 'other',
          file: { name: 'x', type, bytes: new Uint8Array(size) },
          userId: 'u',
        }),
      )
    await expect(send(a, 'text/html', 10)).rejects.toMatchObject({ code: 'DOC_TYPE' })
    await expect(send(a, 'image/png', 0)).rejects.toMatchObject({ code: 'DOC_SIZE' })
    await expect(send(a, 'image/png', 15 * 1024 * 1024 + 1)).rejects.toMatchObject({
      code: 'DOC_SIZE',
    })
    await expect(send(b, 'image/png', 10)).rejects.toMatchObject({ code: 'PO_NOT_FOUND' })
    await expect(
      run(b, (tx) =>
        uploadPurchaseDocument(tx, b.storeId, {
          owner: { inboundShipmentId: newId() },
          kind: 'other',
          file: { name: 'x', type: 'image/png', bytes: new Uint8Array(4) },
          userId: 'u',
        }),
      ),
    ).rejects.toMatchObject({ code: 'SHIPMENT_NOT_FOUND' })
  })

  it('keeps one store’s documents out of another’s reach', async () => {
    const a = await seedStore('a')
    const b = await seedStore('b')
    const po = await order(a, [])
    const doc = await upload(a, { purchaseOrderId: po })
    await expect(run(b, (tx) => loadPurchaseDocument(tx, b.storeId, doc.id))).rejects.toMatchObject(
      {
        code: 'DOC_NOT_FOUND',
      },
    )
    await expect(run(b, (tx) => deletePurchaseDocument(tx, b.storeId, doc.id))).rejects.toThrow()
    expect(await run(b, (tx) => listPurchaseDocuments(tx, { purchaseOrderId: po }))).toEqual([])
    expect(await docRow(doc.id)).toBeDefined()
  })

  it('deletes the record and the file', async () => {
    const c = await seedStore()
    const po = await order(c, [])
    const doc = await upload(c, { purchaseOrderId: po })
    await run(c, (tx) => deletePurchaseDocument(tx, c.storeId, doc.id))
    expect(await docRow(doc.id)).toBeUndefined()
    const storage = await run(c, (tx) => documentStorage(tx, c.storeId))
    expect(await storage.get(doc.fileKey)).toBeNull()
    await expect(run(c, (tx) => purchaseDocumentFile(tx, c.storeId, doc.id))).rejects.toMatchObject(
      { code: 'DOC_NOT_FOUND' },
    )
  })
})

describe('reading a document with AI (worker job, mock provider)', () => {
  it('reads the PDF text, stores the shape and the raw text, and meters the call', async () => {
    const c = await seedStore()
    const po = await order(c, [])
    const doc = await upload(c, { purchaseOrderId: po })
    await readPurchaseDocument({ db: app, storeId: c.storeId, documentId: doc.id })
    const row = await docRow(doc.id)
    expect(row?.status).toBe('ready')
    expect(row?.extracted).toEqual({
      shape: 'supplier_invoice',
      data: MOCK_DOCUMENTS.supplier_invoice,
    })
    expect(row?.rawText).toContain('EX-2026-0042')
    // A second run of the same job finds nothing pending and changes nothing.
    await readPurchaseDocument({ db: app, storeId: c.storeId, documentId: doc.id })
    expect((await docRow(doc.id))?.status).toBe('ready')
  })

  it('fails with a reason when AI is off or the PDF cannot be opened', async () => {
    const c = await seedStore()
    const po = await order(c, [])
    const doc = await upload(c, { purchaseOrderId: po })
    process.env.AI_PROVIDER = 'off'
    await readPurchaseDocument({ db: app, storeId: c.storeId, documentId: doc.id })
    expect(await docRow(doc.id)).toMatchObject({ status: 'failed', error: 'ai_off' })

    process.env.AI_PROVIDER = 'mock'
    const broken = await run(c, (tx) =>
      uploadPurchaseDocument(tx, c.storeId, {
        owner: { purchaseOrderId: po },
        kind: 'bill_of_entry',
        file: { name: 'be.pdf', type: 'application/pdf', bytes: new TextEncoder().encode('nope') },
        userId: 'u',
      }),
    )
    await readPurchaseDocument({ db: app, storeId: c.storeId, documentId: broken.id })
    expect(await docRow(broken.id)).toMatchObject({ status: 'failed', error: 'unreadable' })

    // Read again: back to pending, then read.
    await run(c, (tx) => queuePurchaseDocumentRead(tx, c.storeId, doc.id))
    expect((await docRow(doc.id))?.status).toBe('pending')
    await readPurchaseDocument({ db: app, storeId: c.storeId, documentId: doc.id })
    expect((await docRow(doc.id))?.status).toBe('ready')
  })

  it('sends a photo as it is and reads it as a service bill', async () => {
    const c = await seedStore()
    const po = await order(c, [])
    const doc = await run(c, (tx) =>
      uploadPurchaseDocument(tx, c.storeId, {
        owner: { purchaseOrderId: po },
        kind: 'cha_bill',
        file: { name: 'cha.png', type: 'image/png', bytes: new Uint8Array([137, 80, 78, 71]) },
        userId: 'u',
      }),
    )
    await readPurchaseDocument({ db: app, storeId: c.storeId, documentId: doc.id })
    const row = await docRow(doc.id)
    expect(row).toMatchObject({ status: 'ready', rawText: null })
    expect(row?.extracted).toMatchObject({ shape: 'service_bill' })
  })

  it('fails when the file is gone from storage', async () => {
    const c = await seedStore()
    const po = await order(c, [])
    const doc = await upload(c, { purchaseOrderId: po })
    await (await run(c, (tx) => documentStorage(tx, c.storeId))).delete(doc.fileKey)
    await readPurchaseDocument({ db: app, storeId: c.storeId, documentId: doc.id })
    expect(await docRow(doc.id)).toMatchObject({ status: 'failed', error: 'file_missing' })
  })
})

describe('applying a reviewed document', () => {
  it('updates a draft order: lines, a new product, currency, rate and freight', async () => {
    const c = await seedStore()
    const mouse = await c.addVariant('Mouse', 'M1-BLK')
    const keyboard = await c.addVariant('Keyboard', 'K2-RED')
    const po = await order(c, [{ variantId: mouse, quantity: 100, unitPriceMinor: 1250 }], {
      currency: 'INR',
      fxRate: '1',
    })
    const [mouseLine] = await linesOf(po)
    const id = await readyDocument(c, { purchaseOrderId: po }, 'supplier_invoice')

    const result = await apply(c, {
      id,
      currency: 'USD',
      fxRate: '83.25',
      lines: [
        {
          lineId: mouseLine?.id,
          variantId: mouse,
          quantity: 98,
          unitPriceMinor: 1240,
          hsnCode: '84716060',
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
    })
    expect(result).toEqual({ linesChanged: 2, ordersRated: 1, chargesAdded: 1 })

    expect(await poRow(po)).toMatchObject({ currency: 'USD', fxRate: '83.250000' })
    const lines = await linesOf(po)
    const m = lines.find((l) => l.variantId === mouse)
    const k = lines.find((l) => l.variantId === keyboard)
    // Same line id kept; $12.40 × 83.25 = ₹1,032.30
    expect(m).toMatchObject({
      id: mouseLine?.id,
      quantity: 98,
      unitPriceMinor: 1240,
      hsnCode: '84716060',
    })
    expect(m?.unitCostPaise).toBe(103_230)
    expect(k).toMatchObject({ quantity: 50, unitPriceMinor: 2800, unitCostPaise: 233_100 })
    // $45 freight = ₹3,746.25 split by weight (equal weights) per line, then per unit.
    const splits = await owner.select().from(purchaseChargeSplit)
    expect(splits.reduce((n, s) => n + s.amountPaise, 0)).toBe(374_625)
    expect(m?.landedUnitCostPaise).toBeGreaterThan(103_230)

    expect(await docRow(id)).toMatchObject({ status: 'applied', appliedBy: 'user-1' })
    await expect(apply(c, { id })).rejects.toMatchObject({ code: 'DOC_APPLIED' })
    // Reset lets it be applied again; it undoes nothing.
    await run(c, (tx) => resetPurchaseDocument(tx, c.storeId, id))
    expect(await docRow(id)).toMatchObject({ status: 'ready', appliedAt: null })
    expect(await owner.select().from(purchaseCharge)).toHaveLength(1)
    await expect(run(c, (tx) => resetPurchaseDocument(tx, c.storeId, id))).rejects.toMatchObject({
      code: 'DOC_NOT_APPLIED',
    })
    await expect(
      run(c, (tx) => queuePurchaseDocumentRead(tx, c.storeId, id)),
    ).resolves.toBeUndefined()
  })

  it('refuses line changes on an ordered order but takes a goods adjustment and the rate', async () => {
    const c = await seedStore()
    const mouse = await c.addVariant('Mouse', 'M1-BLK')
    const po = await order(c, [{ variantId: mouse, quantity: 100, unitPriceMinor: 1250 }], {
      markOrdered: true,
    })
    const [line] = await linesOf(po)
    const id = await readyDocument(c, { purchaseOrderId: po }, 'supplier_invoice')

    await expect(
      apply(c, {
        id,
        lines: [{ lineId: line?.id, variantId: mouse, quantity: 98, unitPriceMinor: 1240 }],
      }),
    ).rejects.toMatchObject({ code: 'PO_LINES_LOCKED' })
    expect((await docRow(id))?.status).toBe('ready')

    // 100 × ($12.40 − $12.50) at ₹83.25 = −₹832.50, onto the one line.
    await apply(c, {
      id,
      currency: 'USD',
      fxRate: '83.25',
      charges: [
        {
          kind: 'goods_adjustment',
          amountMinor: -83_250,
          currency: 'INR',
          fxRate: '1',
          gstPaise: 0,
          splitMethod: 'manual',
          manualSplits: [{ lineId: line?.id as string, amountPaise: -83_250 }],
        },
      ],
    })
    const [after] = await linesOf(po)
    expect(after).toMatchObject({ quantity: 100, unitPriceMinor: 1250, unitCostPaise: 104_063 })
    // (₹1,04,062.50 − ₹832.50) / 100 = ₹1,032.30
    expect(after?.landedUnitCostPaise).toBe(103_230)
    // A currency switch is refused on a sent order: the rate is left alone too.
    const other = await readyDocument(c, { purchaseOrderId: po }, 'freight_bill')
    const res = await apply(c, { id: other, currency: 'EUR', fxRate: '90' })
    expect(res.ordersRated).toBe(0)
    expect(await poRow(po)).toMatchObject({ currency: 'USD', fxRate: '83.250000' })
  })

  it('puts a Bill of Entry on a shipment: rate on its orders, BE details, duties split per line', async () => {
    const c = await seedStore()
    const mouse = await c.addVariant('Mouse', 'M1-BLK')
    const keyboard = await c.addVariant('Keyboard', 'K2-RED')
    const po1 = await order(c, [{ variantId: mouse, quantity: 98, unitPriceMinor: 1240 }], {
      markOrdered: true,
    })
    const po2 = await order(c, [{ variantId: keyboard, quantity: 50, unitPriceMinor: 2800 }], {
      markOrdered: true,
      currency: 'INR',
      fxRate: '1',
    })
    const shipment = await run(c, (tx) => saveInboundShipment(tx, c.storeId, { status: 'at_port' }))
    for (const id of [po1, po2]) {
      await run(c, (tx) => attachPurchaseOrder(tx, c.storeId, shipment, id))
    }
    const [l1] = await linesOf(po1)
    const [l2] = await linesOf(po2)
    const id = await readyDocument(c, { inboundShipmentId: shipment }, 'bill_of_entry')
    const duty = (kind: 'customs_bcd' | 'customs_igst', a: number, b: number) => ({
      kind,
      amountMinor: a + b,
      currency: 'INR' as const,
      fxRate: '1',
      gstPaise: 0,
      splitMethod: 'manual' as const,
      manualSplits: [
        { lineId: l1?.id as string, amountPaise: a },
        { lineId: l2?.id as string, amountPaise: b },
      ],
    })

    const result = await apply(c, {
      id,
      currency: 'USD',
      fxRate: '83.25',
      billOfEntry: { number: '7654321', date: '2026-10-02', port: 'INNSA1' },
      charges: [
        duty('customs_bcd', 1_012_000, 1_166_000),
        duty('customs_igst', 2_021_976, 2_329_668),
      ],
    })
    // Only the USD order takes the customs rate.
    expect(result.ordersRated).toBe(1)
    expect(await poRow(po1)).toMatchObject({ fxRate: '83.250000' })
    expect(await poRow(po2)).toMatchObject({ currency: 'INR', fxRate: '1.000000' })
    const [s] = await owner.select().from(inboundShipment).where(eq(inboundShipment.id, shipment))
    expect(s).toMatchObject({
      billOfEntryNo: '7654321',
      billOfEntryDate: '2026-10-02',
      port: 'INNSA1',
    })

    const [m] = await linesOf(po1)
    const [k] = await linesOf(po2)
    // Mouse: 98 × $12.40 × 83.25 = ₹1,01,165.40 + BCD ₹10,120 = ₹1,11,285.40 / 98 = ₹1,135.57; IGST stays out.
    expect(m?.landedUnitCostPaise).toBe(113_557)
    // Keyboard: ₹1,400 + BCD ₹11,660 = ₹13,060 / 50 = ₹261.20
    expect(k?.landedUnitCostPaise).toBe(26_120)
    const charges = await owner.select().from(purchaseCharge)
    expect(charges.every((ch) => ch.inboundShipmentId === shipment)).toBe(true)
    expect(charges.find((ch) => ch.kind === 'customs_igst')?.recoverable).toBe(true)
  })

  it('refuses a document that has not been read, and lines from elsewhere', async () => {
    const c = await seedStore()
    const v = await c.addVariant('Mouse', null)
    const po = await order(c, [{ variantId: v, quantity: 1, unitPriceMinor: 100 }])
    const pending = await upload(c, { purchaseOrderId: po })
    await expect(apply(c, { id: pending.id })).rejects.toMatchObject({ code: 'DOC_NOT_READY' })

    const other = await order(c, [{ variantId: v, quantity: 1, unitPriceMinor: 100 }])
    const [foreign] = await linesOf(other)
    const id = await readyDocument(c, { purchaseOrderId: po }, 'supplier_invoice')
    await expect(
      apply(c, {
        id,
        lines: [{ lineId: foreign?.id, variantId: v, quantity: 2, unitPriceMinor: 100 }],
      }),
    ).rejects.toMatchObject({ code: 'DOC_LINE_NOT_FOUND' })
    const [own] = await linesOf(po)
    const v2 = await c.addVariant('Pad', null)
    await expect(
      apply(c, {
        id,
        lines: [{ lineId: own?.id, variantId: v2, quantity: 2, unitPriceMinor: 100 }],
      }),
    ).rejects.toMatchObject({ code: 'DOC_LINE_MISMATCH' })

    const shipment = await run(c, (tx) => saveInboundShipment(tx, c.storeId, { status: 'at_port' }))
    const be = await readyDocument(c, { inboundShipmentId: shipment }, 'bill_of_entry')
    await expect(
      apply(c, { id: be, lines: [{ variantId: v, quantity: 2, unitPriceMinor: 100 }] }),
    ).rejects.toMatchObject({ code: 'DOC_NEW_LINE_ON_SHIPMENT' })
  })
})
