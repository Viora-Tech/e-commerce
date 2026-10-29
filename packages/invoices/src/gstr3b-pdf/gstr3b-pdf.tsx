import { Document, type DocumentProps, Page, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { Gstr3b, Gstr3bRow } from '../gstr3b'
import { formatRupees } from '../money'

/**
 * GSTR-3B's outward-supply tables (3.1 and 3.2) on one A4 page, ruled like the purchase order,
 * for the merchant to keep beside the portal while typing the figures in.
 */
const MUTED = '#71717a'
const RULE = '#d4d4d8'
const CELL = { paddingVertical: 8, paddingHorizontal: 12 }

export type Gstr3bSheet = {
  report: Gstr3b
  legalName: string
  /** "September 2026". */
  periodLabel: string
  stateName: (pos: string) => string
}

const money = (p: number) => formatRupees(p)

function Row({ cells, widths, head }: { cells: string[]; widths: number[]; head?: boolean }) {
  return (
    <View
      wrap={false}
      style={{ flexDirection: 'row', ...CELL, borderBottomWidth: 0.5, borderColor: RULE }}
    >
      {cells.map((c, i) => (
        <Text
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed columns
          key={i}
          style={{
            width: `${widths[i] ?? 10}%`,
            textAlign: i === 0 ? 'left' : 'right',
            fontSize: head ? 7 : 7.5,
            color: head ? MUTED : '#18181b',
          }}
        >
          {c}
        </Text>
      ))}
    </View>
  )
}

const W31 = [40, 12, 12, 12, 12, 12]
const line = (label: string, r: Gstr3bRow) => [
  label,
  money(r.taxablePaise),
  money(r.igstPaise),
  money(r.cgstPaise),
  money(r.sgstPaise),
  money(r.cessPaise),
]

export default function Gstr3bPdf({
  sheet,
  fontFamily,
}: {
  sheet: Gstr3bSheet
  fontFamily: string[]
}) {
  const r = sheet.report
  return (
    <Document title={`GSTR-3B ${r.gstin} ${r.period}`} author={sheet.legalName} producer="Commerce">
      <Page size="A4" style={{ fontSize: 8, fontFamily, color: '#18181b', padding: 24 }}>
        <View style={{ ...CELL, borderBottomWidth: 0.5, borderColor: RULE }}>
          <Text style={{ fontSize: 7.5, color: MUTED }}>GSTR-3B outward supplies</Text>
          <Text style={{ fontSize: 18, fontWeight: 600 }}>{sheet.periodLabel}</Text>
          <Text style={{ marginTop: 4 }}>
            {sheet.legalName} · GSTIN {r.gstin}
          </Text>
        </View>

        <Text style={{ ...CELL, fontWeight: 600, marginTop: 8 }}>
          3.1 Details of outward supplies and inward supplies liable to reverse charge
        </Text>
        <Row
          head
          widths={W31}
          cells={[
            'Nature of supplies',
            'Taxable value',
            'Integrated',
            'Central',
            'State/UT',
            'Cess',
          ]}
        />
        <Row widths={W31} cells={line('(a) Outward taxable supplies', r.outwardTaxable)} />
        <Row widths={W31} cells={line('(b) Zero rated (exports)', r.zeroRated)} />
        <Row widths={W31} cells={line('(c) Nil rated, exempted', r.nilExempt)} />

        <Text style={{ ...CELL, fontWeight: 600, marginTop: 12 }}>
          3.2 Inter-state supplies to unregistered persons
        </Text>
        <Row
          head
          widths={[52, 24, 24]}
          cells={['Place of supply', 'Taxable value', 'Integrated tax']}
        />
        {r.unregisteredInterState.length === 0 ? (
          <Text style={{ ...CELL, color: MUTED }}>None this month.</Text>
        ) : (
          r.unregisteredInterState.map((p) => (
            <Row
              key={p.pos}
              widths={[52, 24, 24]}
              cells={[
                `${p.pos}-${sheet.stateName(p.pos)}`,
                money(p.taxablePaise),
                money(p.igstPaise),
              ]}
            />
          ))
        )}

        <Text style={{ ...CELL, marginTop: 16, fontSize: 7, color: MUTED }}>
          Worked out from the invoices and credit notes issued in the month. Input tax credit (Table
          4) is not included: purchase GST is not recorded in the store; take it from your GSTR-2B.
        </Text>
      </Page>
    </Document>
  )
}

/** The react-pdf <Document> for `renderToBuffer`. Fonts must already be registered. */
export function gstr3bElement(
  sheet: Gstr3bSheet,
  fontFamily: string[],
): ReactElement<DocumentProps> {
  return <Gstr3bPdf sheet={sheet} fontFamily={fontFamily} />
}
