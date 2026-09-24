import { Image, Rect, Svg, Text, View } from '@react-pdf/renderer'
import { code128Widths } from '../barcode'
import { formatAmount, formatRupees } from '../money'
import type { DocumentSnapshot, Party } from '../snapshot'
import type { TemplateView } from './view'

type BarcodeProps = { value: string; height?: number; module?: number; color?: string }

/** Code 128 drawn as rectangles; no image step, crisp at any zoom. */
export function Barcode({ value, height = 28, module = 0.9, color = '#000000' }: BarcodeProps) {
  const widths = code128Widths(value)
  const quiet = 10 * module
  const total = widths.reduce((a, w) => a + w, 0) * module + quiet * 2
  let x = quiet
  const bars = widths.flatMap((w, i) => {
    const at = x
    x += w * module
    return i % 2 === 0 ? [{ x: at, w: w * module }] : []
  })
  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={total} height={height} viewBox={`0 0 ${total} ${height}`}>
        {bars.map((b) => (
          <Rect key={b.x} x={b.x} y={0} width={b.w} height={height} fill={color} />
        ))}
      </Svg>
      <Text style={{ fontSize: 6.5, marginTop: 1.5, letterSpacing: 0.6 }}>{value}</Text>
    </View>
  )
}

/**
 * The e-invoice QR slot (rule 48(4) IRN QR). Empty until an e-invoicing
 * provider fills `doc.einvoice`, so the layout never shifts when it arrives.
 */
export function QrSlot({ doc, size = 64 }: { doc: DocumentSnapshot; size?: number }) {
  if (!doc.einvoice) return null
  return (
    <View style={{ alignItems: 'center', gap: 2 }}>
      <Image src={doc.einvoice.qrPng} style={{ width: size, height: size }} />
      <Text style={{ fontSize: 5.5 }}>IRN {doc.einvoice.irn.slice(0, 16)}...</Text>
    </View>
  )
}

type PartyLinesProps = {
  party: Party
  showGstin: boolean
  muted: string
  size?: number
}

/** Name, address, state and GSTIN, as rule 46 wants them. */
export function PartyLines({ party, showGstin, muted, size = 8 }: PartyLinesProps) {
  return (
    <View style={{ gap: 1.5 }}>
      <Text style={{ fontSize: size + 1, fontWeight: 600 }}>{party.name}</Text>
      {party.address.map((line) => (
        <Text key={line} style={{ fontSize: size, color: muted }}>
          {line}
        </Text>
      ))}
      {party.state ? (
        <Text style={{ fontSize: size, color: muted }}>
          State: {party.state.name}, code {party.state.gstCode}
        </Text>
      ) : null}
      {showGstin && party.gstin ? (
        <Text style={{ fontSize: size, fontWeight: 600 }}>GSTIN: {party.gstin}</Text>
      ) : null}
      {party.phone ? <Text style={{ fontSize: size, color: muted }}>{party.phone}</Text> : null}
    </View>
  )
}

/** One row of the totals block. */
export function SumRow({
  label,
  value,
  strong,
  size = 8,
  muted,
}: {
  label: string
  value: string
  strong?: boolean
  size?: number
  muted: string
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 1.5 }}>
      <Text
        style={{
          fontSize: size,
          color: strong ? '#111111' : muted,
          fontWeight: strong ? 700 : 400,
        }}
      >
        {label}
      </Text>
      <Text style={{ fontSize: size, fontWeight: strong ? 700 : 400 }}>{value}</Text>
    </View>
  )
}

/**
 * On a pre-order's tax invoice: the advance its receipt voucher (rule 50)
 * recorded, adjusted against the invoice value, and what was paid on top.
 */
export function AdvanceRows({ doc, muted }: { doc: DocumentSnapshot; muted: string }) {
  if (!doc.advance) return null
  const rest = Math.max(0, doc.totals.totalPaise - doc.advance.amountPaise)
  return (
    <View style={{ marginTop: 4 }}>
      <SumRow
        label={`Less advance received (${doc.advance.number})`}
        value={`-${formatRupees(doc.advance.amountPaise)}`}
        muted={muted}
      />
      <SumRow label="Balance received" value={formatRupees(rest)} muted={muted} />
    </View>
  )
}

/** Totals rows every template prints: taxable value, each tax, total. */
export function totalsRows(doc: DocumentSnapshot, view: TemplateView) {
  const t = doc.totals
  const rows: { label: string; value: string }[] = []
  if (view.fields.discount && t.discountPaise > 0) {
    rows.push({ label: 'Gross', value: formatAmount(t.grossPaise) })
    rows.push({ label: 'Discount', value: `-${formatAmount(t.discountPaise)}` })
  }
  if (view.taxDocument) {
    rows.push({ label: 'Taxable value', value: formatAmount(t.taxablePaise) })
    if (doc.interState) rows.push({ label: 'IGST', value: formatAmount(t.igstPaise) })
    else {
      rows.push({ label: 'CGST', value: formatAmount(t.cgstPaise) })
      rows.push({ label: 'SGST/UTGST', value: formatAmount(t.sgstPaise) })
    }
  }
  return rows
}

type TaxTableProps = {
  doc: DocumentSnapshot
  border: string
  head: string
  muted: string
  size?: number
}

/** Rate-wise GST breakup; rule 46 asks for rate and amount of each tax. */
export function TaxTable({ doc, border, head, muted, size = 7 }: TaxTableProps) {
  const inter = doc.interState
  const cols = inter
    ? ['Rate', 'Taxable value', 'IGST']
    : ['Rate', 'Taxable value', 'CGST', 'SGST/UTGST', 'Total tax']
  const cell = { flex: 1, fontSize: size, textAlign: 'right' as const }
  return (
    <View style={{ borderWidth: 0.5, borderColor: border, borderRadius: 2 }}>
      <View style={{ flexDirection: 'row', backgroundColor: head, padding: 3 }}>
        {cols.map((c, i) => (
          <Text key={c} style={{ ...cell, textAlign: i === 0 ? 'left' : 'right', fontWeight: 600 }}>
            {c}
          </Text>
        ))}
      </View>
      {doc.taxSummary.map((r) => (
        <View
          key={r.ratePercent}
          style={{ flexDirection: 'row', padding: 3, borderTopWidth: 0.5, borderColor: border }}
        >
          <Text style={{ ...cell, textAlign: 'left', color: muted }}>{r.ratePercent}%</Text>
          <Text style={cell}>{formatAmount(r.taxablePaise)}</Text>
          {inter ? (
            <Text style={cell}>{formatAmount(r.igstPaise)}</Text>
          ) : (
            <>
              <Text style={cell}>{formatAmount(r.cgstPaise)}</Text>
              <Text style={cell}>{formatAmount(r.sgstPaise)}</Text>
              <Text style={cell}>{formatAmount(r.cgstPaise + r.sgstPaise)}</Text>
            </>
          )}
        </View>
      ))}
    </View>
  )
}

export type Column = {
  key: string
  label: string
  width: number
  align: 'left' | 'center' | 'right'
  render: (l: DocumentSnapshot['lines'][number], index: number) => string
}

/** The item columns a template prints, honouring the field toggles and packing slip mode. */
export function itemColumns(doc: DocumentSnapshot, view: TemplateView): Column[] {
  const f = view.fields
  const cols: (Column | false)[] = [
    { key: 'n', label: '#', width: 4, align: 'left', render: (_, i) => String(i + 1) },
    {
      key: 'item',
      label: view.label('item'),
      width: 30,
      align: 'left',
      render: (l) => l.description,
    },
    f.hsn && { key: 'hsn', label: 'HSN', width: 8, align: 'left', render: (l) => l.hsn },
    {
      key: 'qty',
      label: view.label('quantity'),
      width: 6,
      align: 'center',
      render: (l) =>
        l.quantity === 0
          ? '-'
          : f.unit && !l.charge
            ? `${l.quantity} ${l.unit}`
            : String(l.quantity),
    },
    view.prices && {
      key: 'price',
      label: view.label('price'),
      width: 10,
      align: 'right',
      render: (l) => (l.quantity === 0 ? '-' : formatAmount(l.unitPricePaise)),
    },
    view.prices &&
      f.discount &&
      doc.totals.discountPaise > 0 && {
        key: 'disc',
        label: 'Disc.',
        width: 8,
        align: 'right',
        render: (l) => (l.discountPaise ? formatAmount(l.discountPaise) : '-'),
      },
    view.prices &&
      view.taxDocument && {
        key: 'taxable',
        label: 'Taxable',
        width: 10,
        align: 'right',
        render: (l) => formatAmount(l.taxablePaise),
      },
    view.prices &&
      view.taxDocument && {
        key: 'gst',
        label: doc.interState ? 'IGST' : 'CGST + SGST',
        width: 12,
        align: 'right',
        render: (l) =>
          `${formatAmount(l.cgstPaise + l.sgstPaise + l.igstPaise)}\n${view.rateText(l.ratePercent)}`,
      },
    view.prices && {
      key: 'amount',
      label: view.label('amount'),
      width: 11,
      align: 'right',
      render: (l) => formatAmount(l.totalPaise),
    },
  ]
  const kept = cols.filter((c): c is Column => Boolean(c))
  const sum = kept.reduce((a, c) => a + c.width, 0)
  return kept.map((c) => ({ ...c, width: (c.width / sum) * 100 }))
}
