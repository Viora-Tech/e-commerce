import type { Gstr1Item, Gstr1Json } from './gstr1-json'

/**
 * The outward-supply tables of GSTR-3B, worked out from the month's GSTR-1 so the two
 * returns always agree. Only outward supplies: the store does not record purchase GST, so
 * Table 4 (input tax credit) is the merchant's to fill from their GSTR-2B.
 */
export type Gstr3bRow = {
  taxablePaise: number
  igstPaise: number
  cgstPaise: number
  sgstPaise: number
  cessPaise: number
}

export type Gstr3bPlaceRow = {
  /** Two-digit GST state code. */
  pos: string
  taxablePaise: number
  igstPaise: number
}

export type Gstr3b = {
  gstin: string
  /** `YYYY-MM`. */
  period: string
  /** 3.1(a) Outward taxable supplies (other than zero rated, nil rated and exempted). */
  outwardTaxable: Gstr3bRow
  /** 3.1(b) Outward taxable supplies (zero rated): exports. */
  zeroRated: Gstr3bRow
  /** 3.1(c) Other outward supplies (nil rated, exempted). */
  nilExempt: Gstr3bRow
  /** 3.2 Of 3.1(a), inter-state supplies to unregistered persons, by place of supply. */
  unregisteredInterState: Gstr3bPlaceRow[]
}

const zero = (): Gstr3bRow => ({
  taxablePaise: 0,
  igstPaise: 0,
  cgstPaise: 0,
  sgstPaise: 0,
  cessPaise: 0,
})

/** Rupees with two decimals back to integer paise, so sums stay exact. */
const paise = (rupees: number | undefined) => Math.round((rupees ?? 0) * 100)

function add(
  row: Gstr3bRow,
  d: Partial<Record<'txval' | 'iamt' | 'camt' | 'samt' | 'csamt', number>>,
  sign: 1 | -1,
) {
  row.taxablePaise += sign * paise(d.txval)
  row.igstPaise += sign * paise(d.iamt)
  row.cgstPaise += sign * paise(d.camt)
  row.sgstPaise += sign * paise(d.samt)
  row.cessPaise += sign * paise(d.csamt)
}

const addItems = (row: Gstr3bRow, itms: readonly Gstr1Item[], sign: 1 | -1) => {
  for (const i of itms) add(row, i.itm_det, sign)
}

export function buildGstr3b(gstr1: Gstr1Json): Gstr3b {
  const outwardTaxable = zero()
  const zeroRated = zero()
  const nilExempt = zero()
  const places = new Map<string, Gstr3bPlaceRow>()
  const place = (pos: string, itms: readonly Gstr1Item[], sign: 1 | -1) => {
    const row = places.get(pos) ?? { pos, taxablePaise: 0, igstPaise: 0 }
    for (const i of itms) {
      row.taxablePaise += sign * paise(i.itm_det.txval)
      row.igstPaise += sign * paise(i.itm_det.iamt)
    }
    places.set(pos, row)
  }

  for (const b of gstr1.b2b ?? []) for (const inv of b.inv) addItems(outwardTaxable, inv.itms, 1)
  for (const b of gstr1.b2cl ?? []) {
    for (const inv of b.inv) {
      addItems(outwardTaxable, inv.itms, 1)
      place(b.pos, inv.itms, 1)
    }
  }
  for (const r of gstr1.b2cs ?? []) {
    add(outwardTaxable, r, 1)
    if (r.sply_ty === 'INTER') {
      const row = places.get(r.pos) ?? { pos: r.pos, taxablePaise: 0, igstPaise: 0 }
      row.taxablePaise += paise(r.txval)
      row.igstPaise += paise(r.iamt)
      places.set(r.pos, row)
    }
  }
  for (const e of gstr1.exp ?? [])
    for (const inv of e.inv) for (const i of inv.itms) add(zeroRated, i, 1)
  for (const c of gstr1.cdnr ?? []) for (const nt of c.nt) addItems(outwardTaxable, nt.itms, -1)
  for (const nt of gstr1.cdnur ?? []) {
    if (nt.typ === 'B2CL') {
      addItems(outwardTaxable, nt.itms, -1)
      if (nt.pos) place(nt.pos, nt.itms, -1)
    } else {
      addItems(zeroRated, nt.itms, -1)
    }
  }
  for (const n of gstr1.nil?.inv ?? []) {
    nilExempt.taxablePaise += paise(n.nil_amt) + paise(n.expt_amt)
  }

  const fp = gstr1.fp
  return {
    gstin: gstr1.gstin,
    period: `${fp.slice(2)}-${fp.slice(0, 2)}`,
    outwardTaxable,
    zeroRated,
    nilExempt,
    unregisteredInterState: [...places.values()]
      .filter((r) => r.taxablePaise !== 0 || r.igstPaise !== 0)
      .sort((a, b) => a.pos.localeCompare(b.pos)),
  }
}

const amount = (p: number) => (p / 100).toFixed(2)

function csv(rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return rows.map((r) => r.map(cell).join(',')).join('\n')
}

/** GSTR-3B 3.1 and 3.2 as one CSV, laid out like the portal's tiles. */
export function gstr3bCsv(r: Gstr3b, stateName: (pos: string) => string): string {
  const line = (label: string, row: Gstr3bRow) => [
    label,
    amount(row.taxablePaise),
    amount(row.igstPaise),
    amount(row.cgstPaise),
    amount(row.sgstPaise),
    amount(row.cessPaise),
  ]
  return csv([
    ['GSTR-3B', r.gstin, r.period],
    [],
    [
      '3.1 Nature of supplies',
      'Total taxable value',
      'Integrated tax',
      'Central tax',
      'State/UT tax',
      'Cess',
    ],
    line(
      '(a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
      r.outwardTaxable,
    ),
    line('(b) Outward taxable supplies (zero rated)', r.zeroRated),
    line('(c) Other outward supplies (nil rated, exempted)', r.nilExempt),
    [],
    [
      '3.2 Supplies made to unregistered persons',
      'Place of supply',
      'Total taxable value',
      'Integrated tax',
    ],
    ...r.unregisteredInterState.map((p) => [
      '',
      `${p.pos}-${stateName(p.pos)}`,
      amount(p.taxablePaise),
      amount(p.igstPaise),
    ]),
  ])
}

export type Gstr1Totals = {
  table: string
  documents: number
} & Gstr3bRow

/** One row per GSTR-1 table: how many documents and what they add up to. */
export function gstr1Totals(g: Gstr1Json): Gstr1Totals[] {
  const out: Gstr1Totals[] = []
  const push = (table: string, documents: number, fill: (row: Gstr3bRow) => void) => {
    const row = zero()
    fill(row)
    if (documents > 0) out.push({ table, documents, ...row })
  }
  const invs = <T extends { itms: readonly Gstr1Item[] }>(
    groups: readonly { inv?: T[]; nt?: T[] }[],
  ) => groups.flatMap((x) => x.inv ?? x.nt ?? [])
  const b2b = invs(g.b2b ?? [])
  push('b2b', b2b.length, (row) => {
    for (const i of b2b) addItems(row, i.itms, 1)
  })
  const b2cl = invs(g.b2cl ?? [])
  push('b2cl', b2cl.length, (row) => {
    for (const i of b2cl) addItems(row, i.itms, 1)
  })
  push('b2cs', g.b2cs?.length ?? 0, (row) => {
    for (const r of g.b2cs ?? []) add(row, r, 1)
  })
  const exp = (g.exp ?? []).flatMap((e) => e.inv)
  push('exp', exp.length, (row) => {
    for (const i of exp) for (const it of i.itms) add(row, it, 1)
  })
  const cdnr = invs(g.cdnr ?? [])
  push('cdnr', cdnr.length, (row) => {
    for (const n of cdnr) addItems(row, n.itms, 1)
  })
  push('cdnur', g.cdnur?.length ?? 0, (row) => {
    for (const n of g.cdnur ?? []) addItems(row, n.itms, 1)
  })
  push('nil', g.nil?.inv.length ?? 0, (row) => {
    for (const n of g.nil?.inv ?? []) row.taxablePaise += paise(n.nil_amt) + paise(n.expt_amt)
  })
  const hsn = [...g.hsn.hsn_b2b, ...g.hsn.hsn_b2c]
  push('hsn', hsn.length, (row) => {
    for (const h of hsn) add(row, h, 1)
  })
  return out
}

/** The GSTR-1 totals as a CSV that opens in Excel: one row per table. */
export function gstr1SummaryCsv(g: Gstr1Json): string {
  return csv([
    ['GSTR-1', g.gstin, g.fp],
    [
      'Table',
      'Documents or rows',
      'Taxable value',
      'Integrated tax',
      'Central tax',
      'State/UT tax',
      'Cess',
    ],
    ...gstr1Totals(g).map((t) => [
      t.table,
      t.documents,
      amount(t.taxablePaise),
      amount(t.igstPaise),
      amount(t.cgstPaise),
      amount(t.sgstPaise),
      amount(t.cessPaise),
    ]),
    ...g.doc_issue.doc_det.flatMap((d) =>
      d.docs.map((x) => [
        `docs ${d.doc_num}`,
        x.totnum,
        `${x.from} to ${x.to}`,
        `cancelled ${x.cancel}`,
        `net ${x.net_issue}`,
      ]),
    ),
  ])
}
