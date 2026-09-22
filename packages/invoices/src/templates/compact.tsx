import { Document, Image, Page, Text, View } from '@react-pdf/renderer'
import { formatAmount, formatRupees } from '../money'
import { Barcode, PartyLines, QrSlot, SumRow, TaxTable, totalsRows } from './parts'
import { type TemplateProps, templateView } from './view'

/**
 * GST compact: one column, black on white, no fills, so it prints cleanly on
 * A5 and on thermal printers that rasterise PDFs. Each line stacks its name
 * over quantity, price and amount instead of a wide table.
 */
const MUTED = '#404040'
const RULE = '#000000'

function Dashed() {
  return (
    <View
      style={{
        borderBottomWidth: 0.6,
        borderStyle: 'dashed',
        borderColor: RULE,
        marginVertical: 5,
      }}
    />
  )
}

export default function CompactTemplate(props: TemplateProps & { fontFamily: string[] }) {
  const { doc, settings, assets, fontFamily } = props
  const view = templateView(props)
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
        style={{ padding: 18, fontSize: 7.5, fontFamily, color: '#000000' }}
      >
        <View style={{ alignItems: 'center', gap: 2 }}>
          {assets.logo ? (
            <Image src={assets.logo} style={{ width: 60, height: 30, objectFit: 'contain' }} />
          ) : null}
          <Text style={{ fontSize: 10, fontWeight: 700 }}>{doc.seller.name}</Text>
          {doc.seller.address.map((line) => (
            <Text key={line} style={{ color: MUTED }}>
              {line}
            </Text>
          ))}
          {doc.seller.gstin ? (
            <Text style={{ fontWeight: 600 }}>GSTIN {doc.seller.gstin}</Text>
          ) : null}
          <Text
            style={{
              marginTop: 4,
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: 1,
            }}
          >
            {view.title}
          </Text>
        </View>
        <Dashed />
        {view.meta.map((m) => (
          <View key={m.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: MUTED }}>{m.label}</Text>
            <Text>{m.value}</Text>
          </View>
        ))}
        <Dashed />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontWeight: 700 }}>{view.label('billTo')}</Text>
            <PartyLines party={doc.buyer} showGstin={f.customerGstin} muted={MUTED} size={7} />
          </View>
          {doc.shipTo ? (
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontWeight: 700 }}>{view.label('shipTo')}</Text>
              <PartyLines party={doc.shipTo} showGstin={false} muted={MUTED} size={7} />
            </View>
          ) : null}
        </View>
        <Dashed />
        {view.lines.map((l, i) => (
          <View
            key={`${l.sku ?? l.description}:${l.ratePercent}:${l.totalPaise}`}
            wrap={false}
            style={{ paddingVertical: 2.5 }}
          >
            <Text style={{ fontWeight: 600 }}>
              {i + 1}. {l.description}
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: MUTED }}>
                {[
                  f.sku && l.sku ? `SKU ${l.sku}` : null,
                  f.hsn && l.hsn ? `HSN ${l.hsn}` : null,
                  view.taxDocument && view.prices ? `GST ${view.rateText(l.ratePercent)}` : null,
                ]
                  .filter(Boolean)
                  .join('  ')}
              </Text>
              <Text>
                {view.prices
                  ? l.quantity === 0
                    ? formatAmount(l.totalPaise)
                    : `${l.quantity} x ${formatAmount(l.unitPricePaise)} = ${formatAmount(l.totalPaise)}`
                  : `${view.label('quantity')} ${l.quantity}${f.unit ? ` ${l.unit}` : ''}`}
              </Text>
            </View>
            {view.prices && f.discount && l.discountPaise > 0 ? (
              <Text style={{ color: MUTED, textAlign: 'right' }}>
                incl. discount {formatAmount(l.discountPaise)}
              </Text>
            ) : null}
          </View>
        ))}
        <Dashed />
        {view.prices ? (
          <View>
            {totalsRows(doc, view).map((r) => (
              <SumRow key={r.label} label={r.label} value={r.value} muted={MUTED} size={7.5} />
            ))}
            <SumRow
              label={view.label('total')}
              value={formatRupees(doc.totals.totalPaise)}
              strong
              size={10}
              muted={MUTED}
            />
            <Text style={{ marginTop: 2 }}>{doc.amountInWords}</Text>
          </View>
        ) : null}
        {doc.order.collectPaise > 0 ? (
          <View style={{ marginTop: 5, padding: 5, borderWidth: 1.2, borderColor: RULE }}>
            <SumRow
              label="COLLECT ON DELIVERY"
              value={formatRupees(doc.order.collectPaise)}
              strong
              size={11}
              muted={MUTED}
            />
          </View>
        ) : null}
        {view.taxDocument && f.taxBreakup ? (
          <View style={{ marginTop: 6 }}>
            <TaxTable doc={doc} border={RULE} head="#ffffff" muted={MUTED} size={6.5} />
          </View>
        ) : null}
        {doc.reason ? <Text style={{ marginTop: 5 }}>Reason: {doc.reason}</Text> : null}
        {f.terms && settings.terms ? (
          <Text style={{ marginTop: 5, color: MUTED, fontSize: 6.5 }}>{settings.terms}</Text>
        ) : null}
        {f.notes && settings.notes ? (
          <Text style={{ marginTop: 3, color: MUTED, fontSize: 6.5 }}>{settings.notes}</Text>
        ) : null}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: 8,
          }}
        >
          <View style={{ gap: 4 }}>
            {view.barcode ? <Barcode value={view.barcode} height={26} module={0.8} /> : null}
            <QrSlot doc={doc} size={56} />
          </View>
          {f.signature && view.taxDocument ? (
            <View style={{ alignItems: 'flex-end', gap: 2 }}>
              {assets.signature ? (
                <Image
                  src={assets.signature}
                  style={{ height: 28, width: 90, objectFit: 'contain' }}
                />
              ) : (
                <View style={{ height: 22 }} />
              )}
              <Text style={{ fontSize: 6.5 }}>
                {settings.signatoryName ? `${settings.signatoryName}, ` : ''}
                {view.label('signature')}
              </Text>
            </View>
          ) : null}
        </View>
        {settings.footer ? (
          <Text style={{ marginTop: 8, textAlign: 'center', fontSize: 6.5, color: MUTED }}>
            {settings.footer}
          </Text>
        ) : null}
      </Page>
    </Document>
  )
}
