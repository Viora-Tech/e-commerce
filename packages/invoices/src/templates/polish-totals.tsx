import { Image, Text, View } from '@react-pdf/renderer'
import { formatRupees } from '../money'
import type { InvoiceSettings } from '../settings'
import type { DocumentSnapshot } from '../snapshot'
import { Eyebrow } from './polish-head'
import { HsnTable } from './polish-items'
import { INK, MUTED, type Palette } from './polish-style'
import type { TemplateAssets, TemplateView } from './view'

/**
 * Bottom of the Polish template: HSN breakup, amount in words and terms on
 * the left; the tinted totals box with its accent total bar and the signature
 * on the right.
 */
type BottomProps = {
  doc: DocumentSnapshot
  view: TemplateView
  settings: InvoiceSettings
  assets: TemplateAssets
  p: Palette
}

function Note({
  label,
  text,
  p,
  strong,
}: {
  label: string
  text: string
  p: Palette
  strong?: boolean
}) {
  return (
    <View style={{ gap: 2 }}>
      <Eyebrow color={p.accent}>{label}</Eyebrow>
      <Text
        style={
          strong
            ? { fontSize: 7.5, fontWeight: 500, color: INK }
            : { fontSize: 7, color: MUTED, lineHeight: 1.3 }
        }
      >
        {text}
      </Text>
    </View>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 4,
        paddingHorizontal: 10,
      }}
    >
      <Text style={{ fontSize: 7.5, color: MUTED }}>{label}</Text>
      <Text style={{ fontSize: 7.5, fontWeight: 500, color: INK }}>{value}</Text>
    </View>
  )
}

/**
 * The frame's totals box: Subtotal (goods), Discount, Shipping and other charges, then Taxable
 * value and each tax. Subtotal − Discount + charges is the Total, as in the Figma frame.
 */
export function rupeeRows(doc: DocumentSnapshot, view: TemplateView) {
  const t = doc.totals
  const rows: { label: string; value: string }[] = []
  const goods = doc.lines.filter((l) => !l.charge)
  const charges = doc.lines.filter((l) => l.charge)
  rows.push({ label: 'Subtotal', value: formatRupees(goods.reduce((a, l) => a + l.grossPaise, 0)) })
  if (view.fields.discount && t.discountPaise > 0) {
    rows.push({
      label: doc.discountLabel ? `Discount (${doc.discountLabel})` : 'Discount',
      value: `−${formatRupees(t.discountPaise)}`,
    })
  }
  const shipping = charges.filter((l) => l.description.startsWith('Shipping'))
  // A shipped order with no shipping charge went out free, as the frame shows it.
  if (!shipping.length && doc.shipTo && goods.length)
    rows.push({ label: 'Shipping', value: 'Free' })
  for (const l of charges) {
    const label = l.description.startsWith('Shipping charges')
      ? l.description.replace('Shipping charges', 'Shipping')
      : l.description
    rows.push({ label, value: formatRupees(l.grossPaise) })
  }
  if (view.taxDocument) {
    rows.push({ label: 'Taxable value', value: formatRupees(t.taxablePaise) })
    if (doc.interState) rows.push({ label: 'IGST', value: formatRupees(t.igstPaise) })
    else {
      rows.push({ label: 'CGST', value: formatRupees(t.cgstPaise) })
      rows.push({ label: 'SGST/UTGST', value: formatRupees(t.sgstPaise) })
      // One GST figure for the customer when it is split in two (the frame's IGST row is
      // already that figure); the split above stays for the returns (Rule 46).
      rows.push({ label: 'Total GST', value: formatRupees(t.cgstPaise + t.sgstPaise) })
    }
  }
  return rows
}

export function BottomBlock({ doc, view, settings, assets, p }: BottomProps) {
  const f = view.fields
  return (
    <View wrap={false} style={{ flexDirection: 'row', gap: 22 }}>
      <View style={{ flex: 1, gap: 10 }}>
        {view.taxDocument && f.taxBreakup && doc.hsnSummary.length ? (
          <HsnTable doc={doc} p={p} />
        ) : null}
        {view.prices ? (
          <Note label="Amount in words" text={doc.amountInWords} p={p} strong />
        ) : null}
        {doc.reason ? <Note label="Reason" text={doc.reason} p={p} /> : null}
        {f.terms && settings.terms ? (
          <Note label={view.label('terms')} text={settings.terms} p={p} />
        ) : null}
        {f.notes && settings.notes ? (
          <Note label={view.label('notes')} text={settings.notes} p={p} />
        ) : null}
      </View>

      <View style={{ width: 220, gap: 14 }}>
        {view.prices ? (
          <View style={{ backgroundColor: p.card, borderRadius: 5 }}>
            {rupeeRows(doc, view).map((r) => (
              <Row key={r.label} label={r.label} value={r.value} />
            ))}
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: p.accent,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: 5,
                borderTopLeftRadius: 0,
                borderTopRightRadius: 0,
              }}
            >
              <Text style={{ fontSize: 9, fontWeight: 600, color: '#ffffff' }}>
                {view.label('total')}
              </Text>
              <Text style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                {formatRupees(doc.totals.totalPaise)}
              </Text>
            </View>
          </View>
        ) : null}
        <AdvanceAndCollect doc={doc} p={p} />
        {f.signature && view.taxDocument ? (
          <Signature doc={doc} view={view} settings={settings} assets={assets} />
        ) : null}
      </View>
    </View>
  )
}

/** Pre-order advance adjustment and cash still to collect, when there are any. */
function AdvanceAndCollect({ doc, p }: { doc: DocumentSnapshot; p: Palette }) {
  if (!doc.advance && doc.order.collectPaise <= 0) return null
  const rest = doc.advance ? Math.max(0, doc.totals.totalPaise - doc.advance.amountPaise) : 0
  return (
    <View style={{ gap: 4 }}>
      {doc.advance ? (
        <View style={{ backgroundColor: p.card, borderRadius: 5 }}>
          <Row
            label={`Less advance received (${doc.advance.number})`}
            value={`−${formatRupees(doc.advance.amountPaise)}`}
          />
          <Row label="Balance received" value={formatRupees(rest)} />
        </View>
      ) : null}
      {doc.order.collectPaise > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: p.accent,
            borderRadius: 5,
            paddingVertical: 6,
            paddingHorizontal: 10,
          }}
        >
          <Text style={{ fontSize: 8, fontWeight: 600, color: INK }}>Collect on delivery</Text>
          <Text style={{ fontSize: 9, fontWeight: 700, color: INK }}>
            {formatRupees(doc.order.collectPaise)}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

/** "For <seller>", the signature image, the signatory's name and role, right-aligned. */
function Signature({ doc, view, settings, assets }: Omit<BottomProps, 'p'>) {
  return (
    <View style={{ alignItems: 'flex-end', gap: 3 }}>
      <Text style={{ fontSize: 6.5, fontWeight: 500, color: MUTED }}>For {doc.seller.name}</Text>
      {assets.signature ? (
        <Image src={assets.signature} style={{ height: 32, width: 78, objectFit: 'contain' }} />
      ) : (
        <View style={{ height: 32 }} />
      )}
      {settings.signatoryName ? (
        <Text style={{ fontSize: 7.5, fontWeight: 600, color: INK }}>{settings.signatoryName}</Text>
      ) : null}
      <Text style={{ fontSize: 6.5, color: MUTED }}>{view.label('signature')}</Text>
    </View>
  )
}
