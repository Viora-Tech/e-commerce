import { Document, Page, Text, View } from '@react-pdf/renderer'
import { HeaderBand, type PolishLayout } from './polish-band'
import { MetaStrip, PartyCards } from './polish-head'
import { ItemTable } from './polish-items'
import { MUTED, palette, RULE } from './polish-style'
import { BottomBlock } from './polish-totals'
import { type TemplateProps, templateView } from './view'

/**
 * The Polish family: the owner-approved frames in Figma "GST invoice templates · Polish".
 * One body for all four; `layout` picks the header and signature side (polish-band.tsx):
 * Logo left (965:10804), Logo centre (965:11039), Logo right (965:11273) and White header,
 * the Minimal frame (966:10803). A header with the logo, seller and number, a meta strip
 * with the barcode, left-ruled party cards, a tinted item table, the HSN breakup beside a
 * totals box that ends in an accent total bar, the signature and a ruled footer.
 */
const PAD_X = 32
const FOOTER_SPACE = 44

export default function PolishTemplate(
  props: TemplateProps & { fontFamily: string[]; layout?: PolishLayout },
) {
  const { doc, settings, assets, fontFamily, layout = 'left' } = props
  const plain = layout === 'minimal'
  const view = templateView(props)
  const p = palette(view.accent)
  // The frame says "Computer-generated invoice"; other documents keep their own name.
  const footerTitle = view.title.replace(/^tax /i, '').toLowerCase()

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
        <HeaderBand doc={doc} view={view} assets={assets} p={p} layout={layout} />
        <MetaStrip doc={doc} view={view} p={p} plain={plain} />

        <View style={{ paddingVertical: 18, paddingHorizontal: PAD_X, gap: 16 }}>
          {view.endorsement ? (
            <Text style={{ fontSize: 7.5, fontWeight: 700, color: p.accent }}>
              {view.endorsement}
            </Text>
          ) : null}
          <PartyCards doc={doc} view={view} p={p} plain={plain} />
          <ItemTable doc={doc} view={view} p={p} />
          <BottomBlock
            doc={doc}
            view={view}
            settings={settings}
            assets={assets}
            p={p}
            layout={layout}
          />
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
              `Computer-generated ${footerTitle} · Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}
