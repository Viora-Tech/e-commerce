import { Image, Text, View } from '@react-pdf/renderer'
import type { DocumentSnapshot } from '../snapshot'
import { INK, logoMonogram, MUTED, type Palette, track } from './polish-style'
import type { TemplateAssets, TemplateView } from './view'

/**
 * The header of the Polish family, one per Figma frame in "GST invoice templates · Polish":
 * - `left`: accent band, large logo tile and seller left, number right (965:10804);
 * - `centre`: accent band, medium logo, seller and number stacked in the middle (965:11039);
 * - `right`: accent band, number left, seller and small logo right (965:11273);
 * - `minimal`: white header under a 5pt accent rule, accent logo tile (966:10803).
 */
export type PolishLayout = 'left' | 'centre' | 'right' | 'minimal'

const PAD_X = 32

type BandProps = {
  doc: DocumentSnapshot
  view: TemplateView
  assets: TemplateAssets
  p: Palette
  layout: PolishLayout
}

/** Logo tile sizes from the frames' "Logo · L / M / S" layers. */
const TILES = {
  L: { size: 56, radius: 12.32, font: 17.92, pad: 6 },
  M: { size: 40, radius: 8.8, font: 12.8, pad: 4 },
  S: { size: 28, radius: 6.16, font: 8.96, pad: 3 },
} as const

function LogoTile({
  name,
  logo,
  tile,
  fill,
  ink,
  font,
  radius,
}: {
  name: string
  logo: string | null
  tile: (typeof TILES)[keyof typeof TILES]
  fill: string
  ink: string
  font?: number
  radius?: number
}) {
  const inner = tile.size - tile.pad * 2
  return (
    <View
      style={{
        width: tile.size,
        height: tile.size,
        borderRadius: radius ?? tile.radius,
        backgroundColor: logo ? '#ffffff' : fill,
        alignItems: 'center',
        justifyContent: 'center',
        padding: logo ? tile.pad : 0,
      }}
    >
      {logo ? (
        <Image src={logo} style={{ width: inner, height: inner, objectFit: 'contain' }} />
      ) : (
        <Text style={{ fontSize: font ?? tile.font, fontWeight: 700, color: ink }}>
          {logoMonogram(name)}
        </Text>
      )}
    </View>
  )
}

/** Seller name, address line and GSTIN · email line. */
function SellerText({
  doc,
  align,
  name,
  soft,
}: {
  doc: DocumentSnapshot
  align: 'left' | 'center' | 'right'
  name: string
  soft: string
}) {
  const seller = doc.seller
  // The city line already carries the state name (sellerParty).
  const address = seller.address.join(', ')
  const contact = [seller.gstin ? `GSTIN ${seller.gstin}` : null, seller.email]
    .filter(Boolean)
    .join(' · ')
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontSize: 13, fontWeight: 700, color: name, textAlign: align }}>
        {seller.name}
      </Text>
      {address ? (
        <Text style={{ fontSize: 6.5, color: soft, textAlign: align }}>{address}</Text>
      ) : null}
      {contact ? (
        <Text style={{ fontSize: 6.5, fontWeight: 500, color: soft, textAlign: align }}>
          {contact}
        </Text>
      ) : null}
    </View>
  )
}

/** "Tax invoice", the number and "Original for recipient". */
function TitleBlock({
  doc,
  view,
  align,
  number,
  faint,
}: {
  doc: DocumentSnapshot
  view: TemplateView
  align: 'flex-start' | 'center' | 'flex-end'
  number: string
  faint: string
}) {
  return (
    <View style={{ alignItems: align, gap: 2 }}>
      <Text
        style={{
          fontSize: 7,
          fontWeight: 600,
          color: faint,
          textTransform: 'uppercase',
          letterSpacing: track(7, 12),
        }}
      >
        {view.title}
      </Text>
      <Text style={{ fontSize: 17, fontWeight: 700, color: number }}>
        {doc.number ?? doc.order.name}
      </Text>
      {view.taxDocument ? (
        <Text style={{ fontSize: 6, fontWeight: 500, color: faint }}>Original for recipient</Text>
      ) : null}
    </View>
  )
}

export function HeaderBand({ doc, view, assets, p, layout }: BandProps) {
  const band = {
    backgroundColor: p.accent,
    paddingTop: 24,
    paddingBottom: 22,
    paddingHorizontal: PAD_X,
  }
  const name = doc.seller.name

  if (layout === 'centre') {
    return (
      <View style={{ ...band, alignItems: 'center', gap: 14 }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <LogoTile name={name} logo={assets.logo} tile={TILES.M} fill="#ffffff" ink={p.accent} />
          <SellerText doc={doc} align="center" name="#ffffff" soft={p.onBandSoft} />
        </View>
        <TitleBlock doc={doc} view={view} align="center" number="#ffffff" faint={p.onBandFaint} />
      </View>
    )
  }

  if (layout === 'right') {
    return (
      <View style={{ ...band, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <View style={{ flex: 1 }}>
          <TitleBlock
            doc={doc}
            view={view}
            align="flex-start"
            number="#ffffff"
            faint={p.onBandFaint}
          />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, maxWidth: '60%' }}>
          <View style={{ flexShrink: 1 }}>
            <SellerText doc={doc} align="right" name="#ffffff" soft={p.onBandSoft} />
          </View>
          <LogoTile name={name} logo={assets.logo} tile={TILES.S} fill="#ffffff" ink={p.accent} />
        </View>
      </View>
    )
  }

  const minimal = layout === 'minimal'
  return (
    <View
      style={{
        ...band,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        ...(minimal
          ? { backgroundColor: '#ffffff', borderTopWidth: 5, borderTopColor: p.accent }
          : {}),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
        {minimal ? (
          <LogoTile
            name={name}
            logo={assets.logo}
            tile={TILES.M}
            fill={p.accent}
            ink="#ffffff"
            font={17.92}
            radius={8}
          />
        ) : (
          <LogoTile name={name} logo={assets.logo} tile={TILES.L} fill="#ffffff" ink={p.accent} />
        )}
        <View style={{ flex: 1 }}>
          <SellerText
            doc={doc}
            align="left"
            name={minimal ? INK : '#ffffff'}
            soft={minimal ? MUTED : p.onBandSoft}
          />
        </View>
      </View>
      <TitleBlock
        doc={doc}
        view={view}
        align="flex-end"
        number={minimal ? p.accent : '#ffffff'}
        faint={minimal ? MUTED : p.onBandFaint}
      />
    </View>
  )
}
