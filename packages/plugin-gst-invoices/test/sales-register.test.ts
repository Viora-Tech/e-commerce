import {
  address,
  createDb,
  order,
  orderLine,
  payment,
  product,
  refund,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { issueCreditNote } from '../src/credit-notes'
import { loadSettings, saveSettings } from '../src/issue'
import { setNextNumber } from '../src/next-number'
import { cancelInvoice, enqueueOrder, issueDrafts } from '../src/queue'
import { salesRegister } from '../src/sales-register'
import {
  CREDIT_NOTE_HEADERS,
  GOODS_HEADERS,
  INTERNATIONAL_HEADERS,
  SERVICE_HEADERS,
  SUMMARY_HEADERS,
  salesRegisterFilename,
  salesRegisterXlsx,
} from '../src/sales-register-xlsx'
import { invoice } from '../src/schema'
import { readXlsx, values } from './xlsx-read'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const d = (iso: string) => new Date(iso)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const inStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
  withStore(app, storeId, fn)

async function seedStore() {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'waimers',
      name: 'Waimers',
      gstin: '06AAPFU0939F1ZZ',
      address: { line1: '14 Sector 29', city: 'Gurugram', state: 'HR', pincode: '122001' },
    })
    .returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mouse', title: 'Mouse' })
    .returning()
  const [goods] = await owner
    .insert(variant)
    .values({
      storeId: s.id,
      productId: p?.id as string,
      title: 'Black',
      sku: 'MS-B',
      hsCode: '84716060',
      pricePaise: 100_000,
    })
    .returning()
  const [service] = await owner
    .insert(variant)
    .values({
      storeId: s.id,
      productId: p?.id as string,
      title: 'Repair',
      sku: 'SVC-R',
      hsCode: '998713',
      pricePaise: 100_000,
    })
    .returning()
  return { storeId: s.id, goods: goods?.id as string, service: service?.id as string }
}

type SeedOpts = { country?: string; state?: string; shippingPaise?: number; hsn?: string }

async function seedOrder(storeId: string, variantId: string, n: number, opts: SeedOpts = {}) {
  const shipping = opts.shippingPaise ?? 0
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: `Buyer ${n}`,
      line1: 'Carter Road',
      city: opts.country ? 'Dubai' : 'Mumbai',
      stateCode: opts.state ?? 'MH',
      pincode: '400050',
      country: opts.country ?? 'IN',
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
      shippingPaise: shipping,
      totalPaise: 200_000 + shipping,
    })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId,
    title: 'Mouse',
    variantTitle: 'Black',
    quantity: 2,
    unitPricePaise: 100_000,
    gstRatePercent: 18,
    hsCode: opts.hsn ?? '84716060',
  })
  return o?.id as string
}

async function issueOn(storeId: string, orderId: string, at: Date) {
  return inStore(storeId, async (tx) => {
    const q = await enqueueOrder(tx, storeId, orderId, 'manual', at)
    if (!q) throw new Error('not queued')
    await issueDrafts(tx, storeId, [{ id: q.row.id, invoiceDate: at }], { commit: true, now: at })
    const [row] = await tx.select().from(invoice).where(eq(invoice.id, q.row.id))
    return row as typeof invoice.$inferSelect
  })
}

async function seedRefund(storeId: string, orderId: string, amountPaise: number) {
  const [p] = await owner
    .insert(payment)
    .values({
      storeId,
      orderId,
      provider: 'razorpay',
      providerRef: 'x',
      status: 'captured',
      amountPaise: 205_000,
    })
    .returning()
  const [r] = await owner
    .insert(refund)
    .values({
      storeId,
      orderId,
      paymentId: p?.id as string,
      amountPaise,
      status: 'processed',
      reason: 'Damaged in transit',
    })
    .returning()
  return r?.id as string
}

describe('sales register', () => {
  it('builds the CA register for a month: goods with freight, service, export, credit note, cancelled', async () => {
    const { storeId, goods, service } = await seedStore()
    // Waimers switched from its old billing system: VI/… before, Koomerce series after.
    await inStore(storeId, async (tx) => {
      const s = await loadSettings(tx, storeId)
      const settings = await saveSettings(tx, storeId, {
        ...s,
        lutNumber: 'AD0604260012345',
        lutFy: '2026-27',
        series: s.series.map((x) =>
          x.id === 'inv'
            ? { ...x, carriedFrom: { last: 'VI/26-27/642', fyStartYear: 2026 } }
            : x.id === 'exp'
              ? { ...x, carriedFrom: { last: 'VI/EXP/26-27/001', fyStartYear: 2026 } }
              : x,
        ),
      })
      const exp = settings.series.find((x) => x.id === 'exp')
      if (exp) await setNextNumber(tx, storeId, null, exp, 2, d('2026-10-01T06:00:00Z'))
    })

    const september = await issueOn(
      storeId,
      await seedOrder(storeId, goods, 1),
      d('2026-09-25T06:00:00Z'),
    )
    expect(september.number).toBe('INV/26-27/0001')
    const domesticId = await seedOrder(storeId, goods, 2, { shippingPaise: 5_000 })
    const domestic = await issueOn(storeId, domesticId, d('2026-10-05T06:00:00Z'))
    const svc = await issueOn(
      storeId,
      await seedOrder(storeId, service, 3, { hsn: '998713' }),
      d('2026-10-08T06:00:00Z'),
    )
    const exported = await issueOn(
      storeId,
      await seedOrder(storeId, goods, 4, { country: 'AE', state: 'DU', shippingPaise: 5_000 }),
      d('2026-10-10T06:00:00Z'),
    )
    expect(exported.number).toBe('EXP/26-27/0002')
    const doomed = await issueOn(
      storeId,
      await seedOrder(storeId, goods, 5),
      d('2026-10-12T06:00:00Z'),
    )
    await inStore(storeId, (tx) => cancelInvoice(tx, doomed.id, 'Wrong buyer'))
    const refundId = await seedRefund(storeId, domesticId, 50_000)
    const note = await inStore(storeId, (tx) =>
      issueCreditNote(tx, storeId, refundId, { at: d('2026-10-20T06:00:00Z') }),
    )
    expect(note?.row.number).toBe('CN/26-27/0001')

    const register = await inStore(storeId, (tx) => salesRegister(tx, storeId, '2026-10', null))
    const bytes = await salesRegisterXlsx(register)
    expect(salesRegisterFilename(register)).toBe('SalesRegister_06AAPFU0939F1ZZ_102026.xlsx')
    const book = readXlsx(bytes)
    expect([...book.keys()]).toEqual([
      'Goods',
      'Service',
      'International',
      'Credit Notes',
      'Summary',
    ])

    // Goods: the CA's columns in their order, one row per line, freight its own SAC 996819 row.
    const goodsTab = book.get('Goods') ?? []
    expect(values(goodsTab[0])).toEqual([...GOODS_HEADERS])
    expect(goodsTab).toHaveLength(4) // header, mouse line, freight line, TOTAL
    const [, line, freight, total] = goodsTab
    expect(values(line).slice(0, 8)).toEqual([
      1,
      expect.any(Number),
      'INV/26-27/0002',
      'Buyer 2',
      null,
      8471, // the store prints 4-digit HSN (Settings › HSN digits)
      2,
      0.18,
    ])
    expect(line?.[1]?.format).toBe('dd-mmm-yyyy')
    expect(line?.[7]?.format).toBe('0%')
    for (const c of line?.slice(8, 13) ?? []) {
      expect(c?.numeric).toBe(true)
      expect(c?.format).toBe('#,##0.00')
    }
    // Inter-state (Haryana to Maharashtra): IGST, and the zeros are numbers, not text.
    expect(line?.[10]).toMatchObject({ value: 0, numeric: true })
    expect(line?.[11]).toMatchObject({ value: 0, numeric: true })
    expect(values(line).slice(13, 15)).toEqual(['B2C', 'Maharashtra'])
    expect(line?.[16]).toMatchObject({ value: domestic.totalPaise / 100, numeric: true })
    expect(values(freight).slice(2, 8)).toEqual([
      'INV/26-27/0002',
      'Buyer 2',
      null,
      996819,
      1,
      0.18,
    ])
    expect(String(freight?.[15]?.value)).toMatch(/^Delivery \/ freight \(18%\)/)
    expect(freight?.[16] ?? null).toBeNull()
    const lineSum = Number(line?.[8]?.value) + Number(freight?.[8]?.value)
    expect(lineSum).toBeCloseTo(domestic.totalPaise / 100, 2)
    expect(total?.[7]?.value).toBe('TOTAL')
    expect(total?.[8]?.value).toBeCloseTo(domestic.totalPaise / 100, 2)
    expect(total?.[16]?.value).toBeCloseTo(domestic.totalPaise / 100, 2)
    // The September invoice and the cancelled one are not on the tab.
    const numbers = goodsTab.map((r) => r[2]?.value)
    expect(numbers).not.toContain('INV/26-27/0001')
    expect(numbers).not.toContain(doomed.number)

    const serviceTab = book.get('Service') ?? []
    expect(values(serviceTab[0])).toEqual([...SERVICE_HEADERS])
    expect(values(serviceTab[1]).slice(2, 6)).toEqual([svc.number, 'Buyer 3', null, 9987])

    const intl = book.get('International') ?? []
    expect(values(intl[0])).toEqual([...INTERNATIONAL_HEADERS])
    const exportLine = intl[1]
    expect(values(exportLine).slice(2, 3)).toEqual(['EXP/26-27/0002'])
    expect(exportLine?.[12]).toMatchObject({ value: 0, numeric: true })
    expect(values(exportLine).slice(17)).toEqual([
      'United Arab Emirates',
      null,
      null,
      'AD0604260012345',
      'Without payment of IGST (LUT)',
    ])

    const notes = book.get('Credit Notes') ?? []
    expect(values(notes[0])).toEqual([...CREDIT_NOTE_HEADERS])
    expect(values(notes[1])).toEqual([
      1,
      expect.any(Number),
      'CN/26-27/0001',
      'INV/26-27/0002',
      expect.any(Number),
      'Buyer 2',
      null,
      'Maharashtra',
      'Domestic',
      expect.any(Number),
      0,
      0,
      expect.any(Number),
      500,
      expect.stringContaining('Damaged'),
    ])

    const summary = book.get('Summary') ?? []
    const at = (label: string) => summary.find((r) => r[0]?.value === label)
    expect(values(summary[3])).toEqual([...SUMMARY_HEADERS])
    expect(values(at('Goods'))).toEqual([
      'Goods',
      1,
      domestic.taxablePaise / 100,
      0,
      0,
      domestic.igstPaise / 100,
      domestic.totalPaise / 100,
    ])
    expect(values(at('Service')).slice(0, 2)).toEqual(['Service', 1])
    expect(values(at('International')).slice(0, 2)).toEqual(['International', 1])
    expect(values(at('Less: credit notes')).slice(0, 2)).toEqual(['Less: credit notes', 1])
    expect(at('Less: credit notes')?.[6]?.value).toBe(-500)
    const net = (domestic.totalPaise + svc.totalPaise + exported.totalPaise - 50_000) / 100
    expect(at('Net of credit notes')?.[6]?.value).toBeCloseTo(net, 2)
    for (const c of at('Net of credit notes')?.slice(1) ?? []) expect(c?.numeric).toBe(true)
    // Number ranges per series, and the cancelled number listed.
    expect(values(at('Tax invoices'))).toEqual([
      'Tax invoices',
      'INV/26-27/0002',
      'INV/26-27/0004',
      3,
      1,
    ])
    expect(values(at('Export invoices'))).toEqual([
      'Export invoices',
      'EXP/26-27/0002',
      'EXP/26-27/0002',
      1,
      0,
    ])
    expect(summary.some((r) => r[0]?.value === doomed.number)).toBe(true)
    expect(values(at('NOTE'))).toEqual([
      'NOTE',
      'From 25-Sep-2026 invoices are numbered INV/26-27/NNNN (previously VI/26-27/…). Export invoices continue EXP/26-27/0002 after VI/EXP/26-27/001.',
    ])
  })

  it('shows no numbering note once the year has only one numbering system', async () => {
    const { storeId, goods } = await seedStore()
    await issueOn(storeId, await seedOrder(storeId, goods, 1), d('2026-10-05T06:00:00Z'))
    const register = await inStore(storeId, (tx) => salesRegister(tx, storeId, '2026-10', null))
    expect(register.note).toBeNull()
    const book = readXlsx(await salesRegisterXlsx(register))
    expect(values((book.get('Service') ?? [])[1])).toEqual([
      'No service invoices dated in October 2026.',
    ])
    expect((book.get('Summary') ?? []).some((r) => r[0]?.value === 'NOTE')).toBe(false)
  })
})
