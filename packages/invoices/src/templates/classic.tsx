import { Document, Image, Page, Text, View } from '@react-pdf/renderer'
import { formatRupees } from '../money'
import {
  AdvanceRows,
  Barcode,
  itemColumns,
  PartyLines,
  QrSlot,
  SumRow,
  TaxTable,
  totalsRows,
} from './parts'
import { type TemplateProps, templateView } from './view'

/**
 * Classic: invoicely's "default" template (MIT) re-cut for GST. Accent-colour
 * number and table header, two tinted party cards, zebra rows, totals with the
 * amount in words on the right and terms, notes and signature beside them.
 */
const MUTED = '#6b7280'
const TINT = '#f4f4f5'
const BORDER = '#e4e4e7'

export default function ClassicTemplate(props: TemplateProps & { fontFamily: string[] }) {
  const { doc, settings, assets, fontFamily } = props
  const view = templateView(props)
  const cols = itemColumns(doc, view)
  const f = view.fields

  return (
    <Document
      title={`${view.title} ${doc.number ?? doc.order.name}`}
      author={doc.seller.name}
      creator={doc.seller.name}
      producer="Commerce"
    >
      <Page
        size={settings.paper}
        style={{ padding: 24, fontSize: 8, fontFamily, color: '#111111' }}
      >
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <View style={{ gap: 3 }}>
            <Text
              style={{ fontSize: 8, color: MUTED, textTransform: 'uppercase', letterSpacing: 1 }}
            >
              {view.title}
            </Text>
            <Text style={{ fontSize: 18, fontWeight: 700, color: view.accent }}>
              {doc.number ?? doc.order.name}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <QrSlot doc={doc} />
            {assets.logo ? (
              <Image src={assets.logo} style={{ width: 72, height: 40, objectFit: 'contain' }} />
            ) : null}
          </View>
        </View>

        {view.endorsement ? (
          <Text style={{ marginTop: 6, fontSize: 7.5, fontWeight: 700, color: view.accent }}>
            {view.endorsement}
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
          <View style={{ gap: 2 }}>
            {view.meta.map((m) => (
              <View key={m.label} style={{ flexDirection: 'row' }}>
                <Text style={{ width: 80, fontWeight: 600, fontSize: 7.5 }}>{m.label}</Text>
                <Text style={{ fontSize: 7.5, color: MUTED }}>{m.value}</Text>
              </View>
            ))}
          </View>
          {view.barcode ? <Barcode value={view.barcode} /> : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <View style={{ flex: 1, backgroundColor: TINT, borderRadius: 3, padding: 8, gap: 4 }}>
            <Text style={{ fontWeight: 600, color: view.accent }}>Sold by</Text>
            <PartyLines party={doc.seller} showGstin muted={MUTED} />
          </View>
          <View style={{ flex: 1, backgroundColor: TINT, borderRadius: 3, padding: 8, gap: 4 }}>
            <Text style={{ fontWeight: 600, color: view.accent }}>{view.label('billTo')}</Text>
            <PartyLines party={doc.buyer} showGstin={f.customerGstin} muted={MUTED} />
          </View>
          {doc.shipTo ? (
            <View style={{ flex: 1, backgroundColor: TINT, borderRadius: 3, padding: 8, gap: 4 }}>
              <Text style={{ fontWeight: 600, color: view.accent }}>{view.label('shipTo')}</Text>
              <PartyLines party={doc.shipTo} showGstin={false} muted={MUTED} />
            </View>
          ) : null}
        </View>

        <View style={{ marginTop: 14, flexGrow: 1 }}>
          <View
            fixed
            style={{
              flexDirection: 'row',
              backgroundColor: view.accent,
              borderRadius: 3,
              paddingVertical: 5,
              paddingHorizontal: 6,
            }}
          >
            {cols.map((c) => (
              <Text
                key={c.key}
                style={{
                  width: `${c.width}%`,
                  textAlign: c.align,
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: 7,
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
                paddingVertical: 5,
                paddingHorizontal: 6,
                backgroundColor: i % 2 ? TINT : '#ffffff',
                borderRadius: 2,
              }}
            >
              {cols.map((c) => (
                <View key={c.key} style={{ width: `${c.width}%` }}>
                  <Text
                    style={{
                      textAlign: c.align,
                      fontSize: 7.5,
                      fontWeight: c.key === 'item' ? 600 : 400,
                    }}
                  >
                    {c.render(l, i)}
                  </Text>
                  {c.key === 'item' && f.sku && l.sku ? (
                    <Text style={{ fontSize: 6.5, color: MUTED }}>SKU {l.sku}</Text>
                  ) : null}
                </View>
              ))}
            </View>
          ))}
        </View>

        <View wrap={false} style={{ flexDirection: 'row', gap: 24, marginTop: 10 }}>
          <View style={{ flex: 1, gap: 8, justifyContent: 'flex-end' }}>
            {view.taxDocument && f.taxBreakup ? (
              <TaxTable doc={doc} border={BORDER} head={TINT} muted={MUTED} />
            ) : null}
            {doc.reason ? (
              <View style={{ gap: 2 }}>
                <Text style={{ fontWeight: 600, color: view.accent }}>Reason</Text>
                <Text style={{ fontSize: 7.5, color: MUTED }}>{doc.reason}</Text>
              </View>
            ) : null}
            {f.terms && settings.terms ? (
              <View style={{ gap: 2 }}>
                <Text style={{ fontWeight: 600, color: view.accent }}>{view.label('terms')}</Text>
                <Text style={{ fontSize: 7, color: MUTED }}>{settings.terms}</Text>
              </View>
            ) : null}
            {f.notes && settings.notes ? (
              <View style={{ gap: 2 }}>
                <Text style={{ fontWeight: 600, color: view.accent }}>{view.label('notes')}</Text>
                <Text style={{ fontSize: 7, color: MUTED }}>{settings.notes}</Text>
              </View>
            ) : null}
          </View>

          <View style={{ width: '42%', gap: 2 }}>
            {view.prices ? (
              <>
                {totalsRows(doc, view).map((r) => (
                  <SumRow key={r.label} label={r.label} value={r.value} muted={MUTED} />
                ))}
                <View style={{ borderBottomWidth: 0.5, borderColor: BORDER, marginVertical: 3 }} />
                <SumRow
                  label={view.label('total')}
                  value={formatRupees(doc.totals.totalPaise)}
                  strong
                  size={11}
                  muted={MUTED}
                />
                <Text style={{ fontSize: 6.5, color: MUTED, marginTop: 3 }}>Amount in words</Text>
                <Text style={{ fontSize: 7.5 }}>{doc.amountInWords}</Text>
              </>
            ) : null}
            <AdvanceRows doc={doc} muted={MUTED} />
            {doc.order.collectPaise > 0 ? (
              <View
                style={{
                  marginTop: 6,
                  padding: 6,
                  borderWidth: 1,
                  borderColor: view.accent,
                  borderRadius: 3,
                }}
              >
                <SumRow
                  label="Collect on delivery"
                  value={formatRupees(doc.order.collectPaise)}
                  strong
                  size={10}
                  muted={MUTED}
                />
              </View>
            ) : null}
            {f.signature && view.taxDocument ? (
              <View style={{ alignItems: 'flex-end', marginTop: 10, gap: 3 }}>
                <Text style={{ fontSize: 6.5, color: MUTED }}>For {doc.seller.name}</Text>
                {assets.signature ? (
                  <Image
                    src={assets.signature}
                    style={{ height: 36, width: 110, objectFit: 'contain' }}
                  />
                ) : (
                  <View style={{ height: 30 }} />
                )}
                {settings.signatoryName ? (
                  <Text style={{ fontSize: 7.5 }}>{settings.signatoryName}</Text>
                ) : null}
                <Text style={{ fontSize: 6.5, color: MUTED }}>{view.label('signature')}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {settings.footer ? (
          <Text
            fixed
            style={{
              position: 'absolute',
              bottom: 12,
              left: 24,
              right: 24,
              fontSize: 6.5,
              color: MUTED,
              textAlign: 'center',
            }}
          >
            {settings.footer}
          </Text>
        ) : null}
      </Page>
    </Document>
  )
}
