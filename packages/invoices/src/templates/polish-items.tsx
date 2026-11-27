import { Text, View } from '@react-pdf/renderer'
import { formatRate, formatRupees } from '../money'
import type { DocumentSnapshot } from '../snapshot'
import { type Column, itemColumns } from './parts'
import { INK, MUTED, type Palette, RULE, track } from './polish-style'
import type { TemplateView } from './view'

/**
 * The Polish item table and HSN breakup. Column widths are the Figma frame's
 * (on a 531pt body): #, item, HSN, qty, rate, taxable, GST, amount.
 */
const WIDTHS: Record<string, number> = {
  n: 18,
  item: 200,
  hsn: 40,
  qty: 28,
  price: 52,
  disc: 44,
  taxable: 58,
  gst: 58,
  amount: 63,
}

/** The shared columns, re-weighted to the frame and with rupee amounts. */
function polishColumns(doc: DocumentSnapshot, view: TemplateView): Column[] {
  const renamedPrice = view.config.labels.price
  const cols = itemColumns(doc, view).map((c) => {
    const base = { ...c, width: WIDTHS[c.key] ?? 40 }
    if (c.key === 'qty') return { ...base, align: 'right' as const }
    if (c.key === 'price') {
      return {
        ...base,
        label: renamedPrice || 'Rate',
        render: (l: DocumentSnapshot['lines'][number]) =>
          l.quantity === 0 ? '-' : formatRupees(l.unitPricePaise),
      }
    }
    if (c.key === 'disc') {
      return {
        ...base,
        render: (l: DocumentSnapshot['lines'][number]) =>
          l.discountPaise ? formatRupees(l.discountPaise) : '-',
      }
    }
    if (c.key === 'taxable') {
      return {
        ...base,
        render: (l: DocumentSnapshot['lines'][number]) => formatRupees(l.taxablePaise),
      }
    }
    if (c.key === 'gst') {
      return {
        ...base,
        label: 'GST',
        render: (l: DocumentSnapshot['lines'][number]) =>
          formatRupees(l.cgstPaise + l.sgstPaise + l.igstPaise),
      }
    }
    if (c.key === 'amount') {
      return {
        ...base,
        render: (l: DocumentSnapshot['lines'][number]) => formatRupees(l.totalPaise),
      }
    }
    return base
  })
  const sum = cols.reduce((a, c) => a + c.width, 0)
  return cols.map((c) => ({ ...c, width: (c.width / sum) * 100 }))
}

const sub = (l: DocumentSnapshot['lines'][number], view: TemplateView) => {
  const parts: string[] = []
  if (view.fields.sku && l.sku) parts.push(`SKU ${l.sku}`)
  // Rule 46 wants each line's rate; the HSN table carries it unless the merchant hid that table.
  if (view.taxDocument && view.prices && !view.fields.taxBreakup && !l.charge) {
    parts.push(`GST ${view.rateText(l.ratePercent)}`)
  }
  return parts.join(' · ')
}

/** Tinted head, hairline rows, every other row faintly tinted. */
export function ItemTable({
  doc,
  view,
  p,
}: {
  doc: DocumentSnapshot
  view: TemplateView
  p: Palette
}) {
  const cols = polishColumns(doc, view)
  return (
    <View>
      <View
        fixed
        style={{
          flexDirection: 'row',
          backgroundColor: p.head,
          borderRadius: 3,
          paddingVertical: 6,
          paddingHorizontal: 8,
        }}
      >
        {cols.map((c) => (
          <Text
            key={c.key}
            style={{
              width: `${c.width}%`,
              textAlign: c.align,
              fontSize: 6.2,
              fontWeight: 700,
              color: p.accent,
              textTransform: 'uppercase',
              letterSpacing: track(6.2, 6),
            }}
          >
            {c.label}
          </Text>
        ))}
      </View>
      {view.lines.map((l, i) => (
        <View
          key={`${l.sku ?? l.description}:${l.ratePercent}:${l.totalPaise}`}
          wrap={false}
          style={{
            flexDirection: 'row',
            paddingVertical: 7,
            paddingHorizontal: 8,
            backgroundColor: i % 2 ? p.zebra : '#ffffff',
            borderBottomWidth: 0.5,
            borderBottomColor: RULE,
          }}
        >
          {cols.map((c) => (
            <View key={c.key} style={{ width: `${c.width}%`, gap: 1 }}>
              <Text
                style={{
                  textAlign: c.align,
                  fontSize: 7.5,
                  color: c.key === 'n' ? MUTED : INK,
                  fontWeight: c.key === 'item' || c.key === 'amount' ? 600 : 400,
                  paddingRight: c.key === 'item' ? 6 : 0,
                }}
              >
                {c.render(l, i)}
              </Text>
              {c.key === 'item' && sub(l, view) ? (
                <Text style={{ fontSize: 6.2, color: MUTED }}>{sub(l, view)}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

/** HSN-wise taxable value and tax, in the frame's rounded box. */
export function HsnTable({ doc, p }: { doc: DocumentSnapshot; p: Palette }) {
  const inter = doc.interState
  const head = inter
    ? ['HSN', 'Taxable', 'IGST %', 'IGST']
    : ['HSN', 'Taxable', 'GST %', 'CGST', 'SGST']
  // Fixed column widths in pt, as in the frame; the box is wider and the rest stays empty.
  const widths = inter ? [50, 62, 62, 62] : [50, 62, 40, 42, 42]
  const cell = (i: number) => ({
    width: widths[i] ?? 40,
    textAlign: i === 0 ? ('left' as const) : ('right' as const),
  })
  return (
    <View style={{ borderWidth: 0.75, borderColor: RULE, borderRadius: 4 }}>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: p.strip,
          paddingVertical: 4,
          paddingHorizontal: 8,
          borderTopLeftRadius: 4,
          borderTopRightRadius: 4,
        }}
      >
        {head.map((h, i) => (
          <Text
            key={h}
            style={{
              ...cell(i),
              fontSize: 6,
              fontWeight: 700,
              color: p.accent,
              textTransform: 'uppercase',
            }}
          >
            {h}
          </Text>
        ))}
      </View>
      {doc.hsnSummary.map((r) => {
        const values = inter
          ? [
              r.hsn,
              formatRupees(r.taxablePaise),
              formatRate(r.ratePercent),
              formatRupees(r.igstPaise),
            ]
          : [
              r.hsn,
              formatRupees(r.taxablePaise),
              formatRate(r.ratePercent),
              formatRupees(r.cgstPaise),
              formatRupees(r.sgstPaise),
            ]
        return (
          <View
            key={`${r.hsn}:${r.ratePercent}`}
            style={{ flexDirection: 'row', paddingVertical: 4, paddingHorizontal: 8 }}
          >
            {values.map((v, i) => (
              <Text
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed column order
                key={i}
                style={{ ...cell(i), fontSize: 7, color: i === 0 ? MUTED : INK }}
              >
                {v}
              </Text>
            ))}
          </View>
        )
      })}
    </View>
  )
}
