import { Document, Image, Page, Text, View } from '@react-pdf/renderer'
import { formatRupees } from '../money'
import { Barcode, itemColumns, PartyLines, QrSlot, SumRow, TaxTable, totalsRows } from './parts'
import { type TemplateProps, templateView } from './view'

/**
 * Minimal: invoicely's "vercel" template (MIT), turned light for print. A
 * ruled grid with no fills: large number, meta beside the logo, parties side
 * by side, hairline rows, and the totals column closing the page.
 */
const MUTED = '#71717a'
const RULE = '#d4d4d8'

export default function MinimalTemplate(props: TemplateProps & { fontFamily: string[] }) {
  const { doc, settings, assets, fontFamily } = props
  const view = templateView(props)
  const cols = itemColumns(doc, view)
  const f = view.fields
  const cellPad = { paddingVertical: 10, paddingHorizontal: 14 }

  return (
    <Document
      title={`${view.title} ${doc.number ?? doc.order.name}`}
      author={doc.seller.name}
      creator={doc.seller.name}
      producer="Commerce"
    >
      <Page
        size={settings.paper}
        style={{ fontSize: 8, fontFamily, color: '#18181b', borderWidth: 0.5, borderColor: RULE }}
      >
        <View
          style={{
            ...cellPad,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            borderBottomWidth: 0.5,
            borderColor: RULE,
          }}
        >
          <View>
            <Text style={{ fontSize: 7.5, color: MUTED }}>{view.title}</Text>
            <Text
              style={{ fontSize: 26, fontWeight: 600, letterSpacing: -0.8, color: view.accent }}
            >
              {doc.number ?? doc.order.name}
            </Text>
          </View>
          {view.barcode ? <Barcode value={view.barcode} /> : null}
        </View>

        <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderColor: RULE }}>
          <View
            style={{
              ...cellPad,
              flex: 1,
              gap: 2,
              borderRightWidth: assets.logo || doc.einvoice ? 0.5 : 0,
              borderColor: RULE,
            }}
          >
            {view.meta.map((m) => (
              <View key={m.label} style={{ flexDirection: 'row' }}>
                <Text style={{ width: 84, fontSize: 7.5, color: MUTED }}>{m.label}</Text>
                <Text style={{ fontSize: 7.5 }}>{m.value}</Text>
              </View>
            ))}
          </View>
          {assets.logo || doc.einvoice ? (
            <View
              style={{
                ...cellPad,
                flexDirection: 'row',
                gap: 10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <QrSlot doc={doc} />
              {assets.logo ? (
                <Image src={assets.logo} style={{ width: 84, height: 52, objectFit: 'contain' }} />
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderColor: RULE }}>
          <View style={{ ...cellPad, flex: 1, gap: 4 }}>
            <Text style={{ color: MUTED }}>From</Text>
            <PartyLines party={doc.seller} showGstin muted={MUTED} />
          </View>
          <View style={{ ...cellPad, flex: 1, gap: 4, borderLeftWidth: 0.5, borderColor: RULE }}>
            <Text style={{ color: MUTED }}>{view.label('billTo')}</Text>
            <PartyLines party={doc.buyer} showGstin={f.customerGstin} muted={MUTED} />
          </View>
          {doc.shipTo ? (
            <View style={{ ...cellPad, flex: 1, gap: 4, borderLeftWidth: 0.5, borderColor: RULE }}>
              <Text style={{ color: MUTED }}>{view.label('shipTo')}</Text>
              <PartyLines party={doc.shipTo} showGstin={false} muted={MUTED} />
            </View>
          ) : null}
        </View>

        <View style={{ flexGrow: 1 }}>
          <View
            fixed
            style={{
              flexDirection: 'row',
              paddingVertical: 7,
              paddingHorizontal: 14,
              borderBottomWidth: 0.5,
              borderColor: RULE,
            }}
          >
            {cols.map((c) => (
              <Text
                key={c.key}
                style={{ width: `${c.width}%`, textAlign: c.align, fontSize: 7, color: MUTED }}
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
                paddingVertical: 8,
                paddingHorizontal: 14,
                borderBottomWidth: 0.5,
                borderColor: RULE,
              }}
            >
              {cols.map((c) => (
                <View key={c.key} style={{ width: `${c.width}%` }}>
                  <Text style={{ textAlign: c.align, fontSize: 7.5 }}>{c.render(l, i)}</Text>
                  {c.key === 'item' && f.sku && l.sku ? (
                    <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 1 }}>{l.sku}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>

        <View wrap={false} style={{ flexDirection: 'row', borderTopWidth: 0.5, borderColor: RULE }}>
          <View style={{ flex: 1, borderRightWidth: 0.5, borderColor: RULE }}>
            {view.taxDocument && f.taxBreakup ? (
              <View style={cellPad}>
                <TaxTable doc={doc} border={RULE} head="#ffffff" muted={MUTED} />
              </View>
            ) : null}
            {doc.reason ? (
              <View style={{ ...cellPad, gap: 2, borderTopWidth: 0.5, borderColor: RULE }}>
                <Text>Reason</Text>
                <Text style={{ fontSize: 7, color: MUTED }}>{doc.reason}</Text>
              </View>
            ) : null}
            {f.terms && settings.terms ? (
              <View style={{ ...cellPad, gap: 2, borderTopWidth: 0.5, borderColor: RULE }}>
                <Text>{view.label('terms')}</Text>
                <Text style={{ fontSize: 7, color: MUTED }}>{settings.terms}</Text>
              </View>
            ) : null}
            {f.notes && settings.notes ? (
              <View style={{ ...cellPad, gap: 2, borderTopWidth: 0.5, borderColor: RULE }}>
                <Text>{view.label('notes')}</Text>
                <Text style={{ fontSize: 7, color: MUTED }}>{settings.notes}</Text>
              </View>
            ) : null}
          </View>
          <View style={{ width: '45%' }}>
            {f.signature && view.taxDocument ? (
              <View
                style={{
                  ...cellPad,
                  alignItems: 'flex-end',
                  gap: 2,
                  borderBottomWidth: 0.5,
                  borderColor: RULE,
                }}
              >
                {assets.signature ? (
                  <Image
                    src={assets.signature}
                    style={{ height: 34, width: 110, objectFit: 'contain' }}
                  />
                ) : (
                  <View style={{ height: 28 }} />
                )}
                <Text style={{ fontSize: 6.5, color: MUTED }}>
                  {settings.signatoryName ? `${settings.signatoryName}, ` : ''}
                  {view.label('signature')}
                </Text>
              </View>
            ) : null}
            {view.prices ? (
              <>
                <View style={cellPad}>
                  {totalsRows(doc, view).map((r) => (
                    <SumRow key={r.label} label={r.label} value={r.value} muted={MUTED} />
                  ))}
                </View>
                <View style={{ ...cellPad, borderTopWidth: 0.5, borderColor: RULE }}>
                  <SumRow
                    label={view.label('total')}
                    value={formatRupees(doc.totals.totalPaise)}
                    strong
                    size={12}
                    muted={MUTED}
                  />
                </View>
                <View style={{ ...cellPad, gap: 1, borderTopWidth: 0.5, borderColor: RULE }}>
                  <Text style={{ fontSize: 6.5, color: MUTED }}>Amount in words</Text>
                  <Text style={{ fontSize: 7.5 }}>{doc.amountInWords}</Text>
                </View>
              </>
            ) : null}
            {doc.order.collectPaise > 0 ? (
              <View style={{ ...cellPad, borderTopWidth: 0.5, borderColor: RULE }}>
                <SumRow
                  label="Collect on delivery"
                  value={formatRupees(doc.order.collectPaise)}
                  strong
                  size={11}
                  muted={MUTED}
                />
              </View>
            ) : null}
          </View>
        </View>
        {settings.footer ? (
          <Text
            style={{
              ...cellPad,
              fontSize: 6.5,
              color: MUTED,
              textAlign: 'center',
              borderTopWidth: 0.5,
              borderColor: RULE,
            }}
          >
            {settings.footer}
          </Text>
        ) : null}
      </Page>
    </Document>
  )
}
