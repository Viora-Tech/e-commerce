import { Text, View } from '@react-pdf/renderer'
import type { DocumentSnapshot, Party } from '../snapshot'
import { Barcode, QrSlot } from './parts'
import { INK, MUTED, type Palette, RULE, track } from './polish-style'
import type { TemplateView } from './view'

/**
 * Top of the Polish templates under the header band (polish-band.tsx): the meta strip with
 * the barcode, and the party cards. `plain` is the Minimal frame: no fills, hairline rules.
 */
const PAD_X = 32

const DATE_LABELS: Partial<Record<DocumentSnapshot['kind'], string>> = {
  tax_invoice: 'Invoice date',
  credit_note: 'Credit note date',
}

/** The meta rows as the strip shows them: number dropped (it is in the band), order split. */
export function stripItems(doc: DocumentSnapshot, view: TemplateView) {
  const items: { label: string; value: string }[] = []
  for (const m of view.meta) {
    if (doc.number && m.value === doc.number) continue
    if (m.label === 'Date') {
      items.push({ label: DATE_LABELS[doc.kind] ?? 'Date', value: m.value })
    } else if (m.label === 'Order') {
      const [name, ...rest] = m.value.split(', ')
      items.push({ label: 'Order', value: name ?? m.value })
      if (rest.length) items.push({ label: 'Order date', value: rest.join(', ') })
    } else items.push(m)
  }
  return items
}

/** Tinted strip of dates, order, place of supply and payment, barcode on the right. */
export function MetaStrip({
  doc,
  view,
  p,
  plain = false,
}: {
  doc: DocumentSnapshot
  view: TemplateView
  p: Palette
  plain?: boolean
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        ...(plain
          ? { borderTopWidth: 0.75, borderBottomWidth: 0.75, borderColor: RULE }
          : { backgroundColor: p.strip }),
        paddingVertical: 10,
        paddingHorizontal: PAD_X,
        gap: 26,
      }}
    >
      <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', columnGap: 26, rowGap: 6 }}>
        {stripItems(doc, view).map((m) => (
          <View key={m.label} style={{ gap: 2 }}>
            <Eyebrow color={p.accent} spacing={6}>
              {m.label}
            </Eyebrow>
            <Text style={{ fontSize: 7.5, fontWeight: 500, color: INK }}>{m.value}</Text>
          </View>
        ))}
      </View>
      <QrSlot doc={doc} size={44} />
      {view.barcode ? (
        <Barcode
          value={view.barcode}
          height={26}
          module={1.1}
          color={INK}
          textStyle={{ fontSize: 6, fontWeight: 500, color: MUTED, letterSpacing: track(6, 20) }}
        />
      ) : null}
    </View>
  )
}

/** Small uppercase label in the accent colour. */
export function Eyebrow({
  children,
  color,
  spacing = 6,
  size = 6,
}: {
  children: string
  color: string
  spacing?: number
  size?: number
}) {
  return (
    <Text
      style={{
        fontSize: size,
        fontWeight: 600,
        color,
        textTransform: 'uppercase',
        letterSpacing: track(size, spacing),
      }}
    >
      {children}
    </Text>
  )
}

type Card = { key: string; label: string; title: string; lines: string[] }

const stateLine = (party: Party) =>
  party.state ? `${party.state.name} (${party.state.gstCode})` : null

/** Bill to, ship to and customer GSTIN cards, left-ruled in the accent colour. */
export function PartyCards({
  doc,
  view,
  p,
  plain = false,
}: {
  doc: DocumentSnapshot
  view: TemplateView
  p: Palette
  plain?: boolean
}) {
  const buyer = doc.buyer
  const gstinCard = view.fields.customerGstin && buyer.gstin
  const cards: Card[] = [
    {
      key: 'bill',
      label: view.label('billTo'),
      title: buyer.name,
      lines: [
        ...buyer.address,
        ...(gstinCard ? [] : [stateLine(buyer)].filter((s): s is string => Boolean(s))),
        ...(buyer.phone ? [buyer.phone] : []),
      ],
    },
  ]
  if (doc.shipTo) {
    cards.push({
      key: 'ship',
      label: view.label('shipTo'),
      title: doc.shipTo.name,
      lines: [...doc.shipTo.address, ...(doc.shipTo.phone ? [doc.shipTo.phone] : [])],
    })
  }
  if (gstinCard && buyer.gstin) {
    cards.push({
      key: 'gstin',
      label: 'Customer GSTIN',
      title: buyer.gstin,
      // As in the frame: GSTIN and legal name only. The GSTIN's first two digits are the
      // state code, and the place of supply sits in the meta strip.
      lines: [buyer.name],
    })
  }
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {cards.map((c) => (
        <View
          key={c.key}
          style={{
            width: '32.1%',
            gap: 3,
            paddingVertical: 8,
            paddingHorizontal: 10,
            ...(plain ? {} : { backgroundColor: p.card }),
            borderLeftWidth: 2.5,
            borderLeftColor: p.accent,
          }}
        >
          <Eyebrow color={p.accent} spacing={8}>
            {c.label}
          </Eyebrow>
          <Text style={{ fontSize: 8, fontWeight: 600, color: INK }}>{c.title}</Text>
          {c.lines.map((line) => (
            <Text key={line} style={{ fontSize: 7, color: MUTED }}>
              {line}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}
