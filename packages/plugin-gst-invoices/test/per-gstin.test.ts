import { addRegistration, cancelRegistration } from '@commerce/core/gst-registration-service'
import { gstinCheckChar } from '@commerce/core/gstin'
import { documentRegistration } from '@commerce/core/tax-origin'
import {
  address,
  createDb,
  order,
  orderLine,
  payment,
  product,
  refund,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { DocumentSnapshotSchema } from '@commerce/invoices'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { issueCreditNote } from '../src/credit-notes'
import { loadSettings, saveSettings } from '../src/issue'
import { peekNext } from '../src/next-number'
import { takeNumber } from '../src/numbers'
import { listPeriods, markFiled, setClosed } from '../src/periods'
import { enqueueOrder, issueDrafts } from '../src/queue'
import { orderIssuer } from '../src/registration'
import { gstr1ForPeriod } from '../src/reports'
import { invoice, invoicePeriod, invoiceSequence } from '../src/schema'

/*
 * Phase 2: every number, return month and GSTR-1 belongs to one GSTIN. A store with a Haryana
 * GSTIN (default) and a Karnataka one; orders carry the GSTIN checkout billed them from.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const NL = String.fromCharCode(10)
const d = (iso: string) => new Date(iso)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

function gstin(state: string, pan = 'AAPFU0939F'): string {
  const first14 = `${state}${pan}1Z`
  return first14 + gstinCheckChar(first14)
}
const HR = gstin('06')
const KA = gstin('29')

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

/** A store whose default GSTIN is Haryana's, with a Karnataka one beside it. */
async function seedStore(opts: { withKarnataka?: boolean; withRegistration?: boolean } = {}) {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'waimers',
      name: 'Waimers',
      address: { line1: '14 Sector 29', city: 'Gurugram', state: 'HR', pincode: '122001' },
    })
    .returning()
  if (!s) throw new Error('seed')
  const storeId = s.id
  const ids = { hr: null as string | null, ka: null as string | null }
  if (opts.withRegistration !== false) {
    const hr = await inStore(storeId, (tx) => addRegistration(tx, storeId, { gstin: HR }))
    ids.hr = hr.id
  }
  if (opts.withKarnataka !== false && opts.withRegistration !== false) {
    const ka = await inStore(storeId, (tx) =>
      addRegistration(tx, storeId, {
        gstin: KA,
        invoicePrefix: 'BLR',
        legalAddress: { line1: '5 Whitefield Road', city: 'Bengaluru', pincode: '560066' },
      }),
    )
    ids.ka = ka.id
  }
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: 'kurta', title: 'Kurta' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'M', sku: 'KRT-M', pricePaise: 100_000 })
    .returning()
  return { storeId, variantId: v?.id as string, ...ids }
}

/** An order billed from `gst` (what checkout snapshots), shipped to Mumbai. */
async function seedOrder(
  storeId: string,
  variantId: string,
  n: number,
  gst: string | null,
  interState = true,
) {
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Aarav Mehta',
      line1: 'Carter Road',
      city: 'Mumbai',
      stateCode: 'MH',
      pincode: '400050',
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
      subtotalPaise: 100_000,
      totalPaise: 100_000,
      gstRegistrationId: gst,
      taxBreakdown: {
        taxPaise: 10_714,
        cgstPaise: interState ? 0 : 5_357,
        sgstPaise: interState ? 0 : 5_357,
        igstPaise: interState ? 10_714 : 0,
        ratePercent: 12,
        interState,
      },
    })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId,
    title: 'Kurta',
    variantTitle: 'M',
    quantity: 1,
    unitPricePaise: 100_000,
    gstRatePercent: 12,
    hsCode: '620520',
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

async function usePattern(storeId: string, pattern: string) {
  await inStore(storeId, async (tx) => {
    const s = await loadSettings(tx, storeId)
    await saveSettings(tx, storeId, {
      ...s,
      series: s.series.map((x) => (x.id === 'inv' ? { ...x, pattern } : x)),
    })
  })
}

describe('numbering per GSTIN', () => {
  it('each GSTIN runs its own gapless series; {GST} prints its prefix or state letters', async () => {
    const { storeId, variantId, hr, ka } = await seedStore()
    await usePattern(storeId, '{GST}/{FY}/')
    const a = await seedOrder(storeId, variantId, 1, hr)
    const b = await seedOrder(storeId, variantId, 2, ka)
    const c = await seedOrder(storeId, variantId, 3, hr)
    const at = d('2025-06-02T06:00:00Z')
    const ia = await issueOn(storeId, a, at)
    const ib = await issueOn(storeId, b, at)
    const ic = await issueOn(storeId, c, at)
    expect([ia.number, ib.number, ic.number]).toEqual([
      'HR/25-26/0001',
      'BLR/25-26/0001',
      'HR/25-26/0002',
    ])
    expect([ia.gstRegistrationId, ib.gstRegistrationId]).toEqual([hr, ka])
  })

  it('two GSTINs may print the same number: rule 46(b) is per GSTIN', async () => {
    const { storeId, variantId, hr, ka } = await seedStore()
    const at = d('2025-06-02T06:00:00Z')
    const one = await issueOn(storeId, await seedOrder(storeId, variantId, 1, hr), at)
    const two = await issueOn(storeId, await seedOrder(storeId, variantId, 2, ka), at)
    expect(one.number).toBe('INV/25-26/0001')
    expect(two.number).toBe('INV/25-26/0001')
    const seqs = await owner.select().from(invoiceSequence)
    expect(seqs.map((s) => s.gstRegistrationId).sort()).toEqual([hr, ka].sort())
  })

  it('prints the issuing GSTIN as the seller; the default keeps the app seller block', async () => {
    const { storeId, variantId, hr, ka } = await seedStore()
    const at = d('2025-06-02T06:00:00Z')
    const hrDoc = DocumentSnapshotSchema.parse(
      (await issueOn(storeId, await seedOrder(storeId, variantId, 1, hr), at)).snapshot,
    )
    const kaDoc = DocumentSnapshotSchema.parse(
      (await issueOn(storeId, await seedOrder(storeId, variantId, 2, ka), at)).snapshot,
    )
    expect(hrDoc.seller).toMatchObject({ gstin: HR, name: 'Waimers' })
    expect(hrDoc.seller.address[0]).toBe('14 Sector 29')
    // Another GSTIN prints its business's PAN name and its own registered address.
    expect(kaDoc.seller).toMatchObject({ gstin: KA, name: 'Waimers' })
    expect(kaDoc.seller.state?.gstCode).toBe('29')
    expect(kaDoc.seller.address).toEqual(['5 Whitefield Road', 'Bengaluru, Karnataka, 560066'])
  })

  it('an order without a checkout GSTIN is billed from the default one', async () => {
    const { storeId, variantId, hr } = await seedStore()
    const orderId = await seedOrder(storeId, variantId, 1, null)
    const issuer = await inStore(storeId, (tx) => orderIssuer(tx, orderId))
    expect(issuer?.id).toBe(hr)
    const q = await inStore(storeId, (tx) => enqueueOrder(tx, storeId, orderId, 'manual'))
    expect(q?.row.gstRegistrationId).toBe(hr)
  })

  it('restarts every GSTIN at 1 on 1 April (IST), each on its own', async () => {
    const { storeId, variantId, hr, ka } = await seedStore()
    const march = d('2026-03-31T18:00:00Z') // 31 March, 23:30 IST
    const april = d('2026-03-31T18:31:00Z') // 1 April, 00:01 IST
    await issueOn(storeId, await seedOrder(storeId, variantId, 1, hr), march)
    expect((await issueOn(storeId, await seedOrder(storeId, variantId, 2, ka), march)).number).toBe(
      'INV/25-26/0001',
    )
    expect((await issueOn(storeId, await seedOrder(storeId, variantId, 3, ka), april)).number).toBe(
      'INV/26-27/0001',
    )
    expect((await issueOn(storeId, await seedOrder(storeId, variantId, 4, hr), april)).number).toBe(
      'INV/26-27/0001',
    )
    expect((await issueOn(storeId, await seedOrder(storeId, variantId, 5, ka), april)).number).toBe(
      'INV/26-27/0002',
    )
  })

  it('concurrent issuers on two GSTINs get every number once, and a rollback leaves no gap', async () => {
    const { storeId, hr, ka } = await seedStore()
    const at = d('2025-06-02T06:00:00Z')
    const take = (gst: string | null, fail = false) =>
      inStore(storeId, async (tx) => {
        const settings = await loadSettings(tx, storeId)
        const issuer = await documentRegistration(tx, gst)
        const n = await takeNumber(
          tx,
          storeId,
          'tax_invoice',
          at,
          settings,
          { export: false, b2b: false },
          issuer,
        )
        if (fail) throw new Error('rolled back')
        return n
      })
    const runs = await Promise.allSettled([
      ...Array.from({ length: 8 }, () => take(hr)),
      ...Array.from({ length: 8 }, () => take(ka)),
      take(hr, true),
      take(ka, true),
    ])
    const taken = runs.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []))
    expect(runs.filter((r) => r.status === 'rejected')).toHaveLength(2)
    const seqOf = (gst: string | null) =>
      taken
        .filter((t) => t.gstRegistrationId === gst)
        .map((t) => t.seq)
        .sort((x, y) => x - y)
    const oneToEight = [1, 2, 3, 4, 5, 6, 7, 8]
    expect(seqOf(hr)).toEqual(oneToEight)
    expect(seqOf(ka)).toEqual(oneToEight)
    // The rolled-back takes returned their numbers: both counters hand out 9 next.
    expect(await inStore(storeId, (tx) => peekNext(tx, hr, 'inv', 2025))).toBe(9)
    expect(await inStore(storeId, (tx) => peekNext(tx, ka, 'inv', 2025))).toBe(9)
  })
})

describe('returns per GSTIN', () => {
  it('GSTR-1 lists only the picked GSTIN’s documents', async () => {
    const { storeId, variantId, hr, ka } = await seedStore()
    const at = d('2026-09-05T06:00:00Z')
    const h = await issueOn(storeId, await seedOrder(storeId, variantId, 1, hr), at)
    const k1 = await issueOn(storeId, await seedOrder(storeId, variantId, 2, ka), at)
    const k2 = await issueOn(storeId, await seedOrder(storeId, variantId, 3, ka), at)
    const range = [d('2026-08-31T18:30:00Z'), d('2026-09-30T18:30:00Z')] as const
    const ofKa = await inStore(storeId, (tx) => gstr1ForPeriod(tx, ...range, ka))
    const ofHr = await inStore(storeId, (tx) => gstr1ForPeriod(tx, ...range, hr))
    const docsRow = (csv: string) => csv.split(NL)[1] ?? ''
    // Table 13: Karnataka issued 0001 to 0002, Haryana only 0001.
    expect(docsRow(ofKa.docs)).toContain(`${k1.number},${k2.number},2,0`)
    expect(docsRow(ofHr.docs)).toContain(`${h.number},${h.number},1,0`)
  })

  it('filing and closing a month touch one GSTIN only', async () => {
    const { storeId, variantId, hr, ka } = await seedStore()
    const june = d('2025-06-10T06:00:00Z')
    const hrInv = await issueOn(storeId, await seedOrder(storeId, variantId, 1, hr), june)
    const kaInv = await issueOn(storeId, await seedOrder(storeId, variantId, 2, ka), june)
    await inStore(storeId, (tx) => markFiled(tx, storeId, '2025-06', true, ka))
    const rows = await owner.select().from(invoice)
    const reported = (id: string) => rows.find((r) => r.id === id)?.reportedPeriod ?? null
    expect(reported(kaInv.id)).toBe('2025-06')
    expect(reported(hrInv.id)).toBeNull()

    await inStore(storeId, (tx) => setClosed(tx, storeId, '2025-06', true, hr))
    const late = d('2025-06-20T06:00:00Z')
    await expect(
      issueOn(storeId, await seedOrder(storeId, variantId, 3, hr), late),
    ).rejects.toThrow(/closed/)
    const ok = await issueOn(storeId, await seedOrder(storeId, variantId, 4, ka), late)
    expect(ok.number).toBe('INV/25-26/0002')
    const hrMonths = await inStore(storeId, (tx) => listPeriods(tx, storeId, hr))
    const kaMonths = await inStore(storeId, (tx) => listPeriods(tx, storeId, ka))
    expect(hrMonths.map((p) => [p.period, Boolean(p.closedAt), Boolean(p.gstr1FiledAt)])).toEqual([
      ['2025-06', true, false],
    ])
    expect(kaMonths.map((p) => [p.period, Boolean(p.closedAt), Boolean(p.gstr1FiledAt)])).toEqual([
      ['2025-06', false, true],
    ])
  })
})

describe('credit notes per GSTIN', () => {
  async function refundFor(storeId: string, orderId: string, amountPaise: number) {
    const [p] = await owner
      .insert(payment)
      .values({
        storeId,
        orderId,
        provider: 'razorpay',
        providerRef: 'x',
        status: 'captured',
        amountPaise: 100_000,
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
        reason: 'Damaged',
      })
      .returning()
    return r?.id as string
  }

  it('comes from the invoice’s GSTIN and series, even after that GSTIN is cancelled', async () => {
    const { storeId, variantId, hr, ka } = await seedStore()
    await inStore(storeId, async (tx) => {
      const s = await loadSettings(tx, storeId)
      await saveSettings(tx, storeId, {
        ...s,
        series: s.series.map((x) => (x.id === 'cn' ? { ...x, pattern: '{GST}/{FY}/' } : x)),
      })
    })
    // Haryana has used a credit note number already; Karnataka's series is its own.
    const hrOrder = await seedOrder(storeId, variantId, 1, hr)
    await issueOn(storeId, hrOrder, d('2026-09-01T06:00:00Z'))
    const hrRefund = await refundFor(storeId, hrOrder, 10_000)
    await inStore(storeId, (tx) =>
      issueCreditNote(tx, storeId, hrRefund, { at: d('2026-09-02T06:00:00Z') }),
    )
    const kaOrder = await seedOrder(storeId, variantId, 2, ka)
    const inv = await issueOn(storeId, kaOrder, d('2026-09-03T06:00:00Z'))
    await inStore(storeId, (tx) => cancelRegistration(tx, storeId, ka as string))
    const kaRefund = await refundFor(storeId, kaOrder, 20_000)
    const note = await inStore(storeId, (tx) =>
      issueCreditNote(tx, storeId, kaRefund, { at: d('2026-09-05T06:00:00Z') }),
    )
    expect(note?.row).toMatchObject({ number: 'BLR/26-27/0001', gstRegistrationId: ka })
    const doc = DocumentSnapshotSchema.parse(note?.row.snapshot)
    expect(doc.seller.gstin).toBe(KA)
    expect(doc.original?.number).toBe(inv.number)
  })
})

describe('a store adding its first GSTIN', () => {
  it('hands earlier numbers, counters and months to it, so the series carries on', async () => {
    const { storeId, variantId } = await seedStore({ withRegistration: false })
    const first = await issueOn(
      storeId,
      await seedOrder(storeId, variantId, 1, null),
      d('2025-06-02T06:00:00Z'),
    )
    expect(first).toMatchObject({ number: 'INV/25-26/0001', gstRegistrationId: null })
    await inStore(storeId, (tx) => setClosed(tx, storeId, '2025-05', true, null))

    const reg = await inStore(storeId, (tx) => addRegistration(tx, storeId, { gstin: HR }))
    const [moved] = await owner.select().from(invoice).where(eq(invoice.id, first.id))
    expect(moved?.gstRegistrationId).toBe(reg.id)
    const [counter] = await owner.select().from(invoiceSequence)
    expect(counter?.gstRegistrationId).toBe(reg.id)
    const [month] = await owner.select().from(invoicePeriod)
    expect(month?.gstRegistrationId).toBe(reg.id)

    const next = await issueOn(
      storeId,
      await seedOrder(storeId, variantId, 2, null),
      d('2025-06-03T06:00:00Z'),
    )
    expect(next).toMatchObject({ number: 'INV/25-26/0002', gstRegistrationId: reg.id })
  })
})
