import { Image, Text, View } from '@react-pdf/renderer'
import type { DocumentSnapshot, Party } from '../snapshot'
import { Barcode, QrSlot } from './parts'
import { stripItems } from './polish-meta'
import { INK, logoMonogram, MUTED, type Palette, track } from './polish-style'
import type { TemplateAssets, TemplateView } from './view'

/**
 * Top of the Polish template: the accent header band with the logo on the
 * left, the meta strip with the barcode, and the party cards.
 */
const PAD_X = 32

type BandProps = { doc: DocumentSnapshot; view: TemplateView; assets: TemplateAssets; p: Palette }

/** Logo tile, seller name, address and GSTIN on the left; title and number on the right. */
export function HeaderBand({ doc, view, assets, p }: BandProps) {
  const seller = doc.seller
  // The city line already carries the state name (sellerParty).
  const address = seller.address.join(', ')
  const contact = [seller.gstin ? `GSTIN ${seller.gstin}` : null, seller.email]
    .filter(Boolean)
    .join(' · ')
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        backgroundColor: p.accent,
        paddingTop: 24,
        paddingBottom: 22,
        paddingHorizontal: PAD_X,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 12.32,
            backgroundColor: '#ffffff',
            alignItems: 'center',
            justifyContent: 'center',
            padding: assets.logo ? 6 : 0,
          }}
        >
          {assets.logo ? (
            <Image src={assets.logo} style={{ width: 44, height: 44, objectFit: 'contain' }} />
          ) : (
            <Text style={{ fontSize: 17.92, fontWeight: 700, color: p.accent }}>
              {logoMonogram(seller.name)}
            </Text>
          )}
        </View>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{seller.name}</Text>
          {address ? <Text style={{ fontSize: 6.5, color: p.onBandSoft }}>{address}</Text> : null}
          {contact ? (
            <Text style={{ fontSize: 6.5, fontWeight: 500, color: p.onBandSoft }}>{contact}</Text>
          ) : null}
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 2 }}>
        <Text
          style={{
            fontSize: 7,
            fontWeight: 600,
            color: p.onBandFaint,
            textTransform: 'uppercase',
            letterSpacing: track(7, 12),
          }}
        >
          {view.title}
        </Text>
        <Text style={{ fontSize: 17, fontWeight: 700, color: '#ffffff' }}>
          {doc.number ?? doc.order.name}
        </Text>
        {view.taxDocument ? (
          <Text style={{ fontSize: 6, fontWeight: 500, color: p.onBandFaint }}>
            Original for recipient
          </Text>
        ) : null}
      </View>
    </View>
  )
}

/** Tinted strip of dates, order, place of supply and payment, barcode on the right. */
export function MetaStrip({
  doc,
  view,
  p,
}: {
  doc: DocumentSnapshot
  view: TemplateView
  p: Palette
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: p.strip,
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
}: {
  doc: DocumentSnapshot
  view: TemplateView
  p: Palette
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
      lines: [buyer.name, stateLine(buyer)].filter((s): s is string => Boolean(s)),
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
            backgroundColor: p.card,
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
