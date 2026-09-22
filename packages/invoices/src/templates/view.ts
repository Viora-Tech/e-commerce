import { formatRate } from '../money'
import type { DocumentConfig, DocumentFields, InvoiceSettings, LabelKey } from '../settings'
import type { DocumentKind, DocumentSnapshot } from '../snapshot'

const TITLES: Record<DocumentKind, string> = {
  tax_invoice: 'Tax Invoice',
  credit_note: 'Credit Note',
  packing_slip: 'Packing Slip',
  order_confirmation: 'Order Confirmation',
}

const DEFAULT_LABELS: Record<LabelKey, string> = {
  title: '',
  billTo: 'Bill to',
  shipTo: 'Ship to',
  item: 'Item',
  quantity: 'Qty',
  price: 'Price',
  amount: 'Amount',
  total: 'Total',
  terms: 'Terms',
  notes: 'Notes',
  signature: 'Authorised signatory',
}

export type TemplateAssets = {
  /** Data URI or URL of the logo; null prints the name alone. */
  logo: string | null
  signature: string | null
}

export type TemplateProps = {
  doc: DocumentSnapshot
  settings: InvoiceSettings
  assets: TemplateAssets
}

/** Everything a template decides from the document and settings, computed once. */
export type TemplateView = {
  title: string
  label: (key: LabelKey) => string
  fields: DocumentFields
  /** Packing slips can leave prices off. */
  prices: boolean
  /** Slips and confirmations are not tax documents; they skip the GST blocks. */
  taxDocument: boolean
  accent: string
  /** Order or document number as a Code 128 value; null hides the barcode. */
  barcode: string | null
  /** Human text of a line's tax: "18%" or "9% + 9%". */
  rateText: (ratePercent: number) => string
  lines: DocumentSnapshot['lines']
  config: DocumentConfig
  /** Printed under the heading: invoice number, dates, order. */
  meta: { label: string; value: string }[]
}

const date = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso))

export function templateView({ doc, settings }: TemplateProps): TemplateView {
  const config = settings.documents[doc.kind]
  const labels = config.labels
  const label = (key: LabelKey) => labels[key] || DEFAULT_LABELS[key]
  const taxDocument = doc.kind === 'tax_invoice' || doc.kind === 'credit_note'
  const prices = doc.kind !== 'packing_slip' || settings.packingSlipPrices
  const barcodeText =
    settings.barcodeValue === 'document' && doc.number
      ? doc.number
      : doc.order.name.replace('#', '')
  const meta = [
    ...(doc.number
      ? [
          {
            label: doc.kind === 'credit_note' ? 'Credit note no.' : 'Invoice no.',
            value: doc.number,
          },
        ]
      : []),
    { label: doc.number ? 'Date' : 'Issued', value: date(doc.issuedAt) },
    { label: 'Order', value: `${doc.order.name}, ${date(doc.order.placedAt)}` },
    ...(doc.original
      ? [
          {
            label: 'Against invoice',
            value: `${doc.original.number}, ${date(doc.original.issuedAt)}`,
          },
        ]
      : []),
    ...(taxDocument && doc.placeOfSupply
      ? [
          {
            label: 'Place of supply',
            value: `${doc.placeOfSupply.name} (${doc.placeOfSupply.gstCode})`,
          },
        ]
      : []),
    ...(taxDocument ? [{ label: 'Reverse charge', value: 'No' }] : []),
    ...(config.fields.paymentMethod && doc.order.paymentMethod
      ? [{ label: 'Payment', value: doc.order.paymentMethod }]
      : []),
  ]
  return {
    title: labels.title || TITLES[doc.kind],
    label,
    fields: config.fields,
    prices,
    taxDocument,
    accent: settings.accentColor,
    barcode: config.fields.barcode && /^[\x20-\x7e]+$/.test(barcodeText) ? barcodeText : null,
    rateText: (r) =>
      doc.interState ? formatRate(r) : `${formatRate(r / 2)} + ${formatRate(r / 2)}`,
    lines: doc.kind === 'packing_slip' ? doc.lines.filter((l) => !l.charge) : doc.lines,
    config,
    meta,
  }
}

/** All printable text, so the font stack can add CJK only when it is needed. */
export function documentText(doc: DocumentSnapshot, settings: InvoiceSettings): string {
  const party = (p: DocumentSnapshot['buyer'] | null) => (p ? [p.name, ...p.address].join(' ') : '')
  return [
    party(doc.seller),
    party(doc.buyer),
    party(doc.shipTo),
    ...doc.lines.map((l) => l.description),
    doc.reason ?? '',
    settings.terms,
    settings.notes,
    settings.footer,
    settings.signatoryName,
    ...Object.values(settings.documents[doc.kind].labels),
  ].join(' ')
}
