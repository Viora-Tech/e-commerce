import { Document, Page, Text, View } from '@react-pdf/renderer'
import { HeaderBand, MetaStrip, PartyCards } from './polish-head'
import { ItemTable } from './polish-items'
import { MUTED, palette, RULE } from './polish-style'
import { BottomBlock } from './polish-totals'
import { type TemplateProps, templateView } from './view'

/**
 * Polish ("Logo left"): the owner-approved frame from Figma "GST invoice
 * templates · Polish" (Classic · Indigo · logo left L · sign right). A full
 * bleed accent band with the logo tile and seller on the left and the
 * document number on the right, a tinted meta strip with the barcode,
 * left-ruled party cards, a tinted item table, the HSN breakup beside a
 * totals box that ends in an accent total bar, and a ruled footer.
 */
const PAD_X = 32
const FOOTER_SPACE = 44

export default function PolishTemplate(props: TemplateProps & { fontFamily: string[] }) {
  const { doc, settings, assets, fontFamily } = props
  const view = templateView(props)
  const p = palette(view.accent)

  return (
    <Document
      title={`${view.title} ${doc.number ?? doc.order.name}`}
      author={doc.seller.name}
      creator={doc.seller.name}
      producer="Commerce"
    >
      <Page
        size={settings.paper}
        style={{ fontSize: 8, fontFamily, color: '#111827', paddingBottom: FOOTER_SPACE }}
      >
        <HeaderBand doc={doc} view={view} assets={assets} p={p} />
        <MetaStrip doc={doc} view={view} p={p} />

        <View style={{ paddingVertical: 18, paddingHorizontal: PAD_X, gap: 16 }}>
          {view.endorsement ? (
            <Text style={{ fontSize: 7.5, fontWeight: 700, color: p.accent }}>
              {view.endorsement}
            </Text>
          ) : null}
          <PartyCards doc={doc} view={view} p={p} />
          <ItemTable doc={doc} view={view} p={p} />
          <BottomBlock doc={doc} view={view} settings={settings} assets={assets} p={p} />
        </View>

        <View
          fixed
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingTop: 10,
            paddingBottom: 12,
            marginHorizontal: 0,
            paddingHorizontal: PAD_X,
            borderTopWidth: 0.75,
            borderTopColor: RULE,
          }}
        >
          <Text style={{ fontSize: 7, fontWeight: 500, color: p.accent, maxWidth: '65%' }}>
            {settings.footer}
          </Text>
          <Text
            style={{ fontSize: 6, color: MUTED }}
            render={({ pageNumber, totalPages }) =>
              `Computer-generated ${view.title.toLowerCase()} · Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
