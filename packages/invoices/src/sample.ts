import { buildCreditNote } from './credit-note'
import { buildDocument } from './document'
import { financialYear } from './numbering'
import { placeOf, sellerParty } from './parties'
import { formatSeriesNumber, pickSeries } from './series'
import type { InvoiceSettings } from './settings'
import type { DocumentKind, DocumentSnapshot } from './snapshot'

/**
 * A believable order for the settings preview: two GST rates, a discount,
 * shipping, an inter-state buyer and one Hindi line so the fonts show their
 * fallback. Nothing here touches the database.
 */
export function sampleDocument(
  settings: InvoiceSettings,
  kind: DocumentKind,
  storeName: string,
  now: Date = new Date(),
): DocumentSnapshot {
  // The diya set is the line the sample credit note returns.
  const diya = '00000000-0000-4000-8000-0000000d1a00'
  const fy = financialYear(now)
  const numberFor = (kind: 'tax_invoice' | 'credit_note', seq: number) => {
    const series = pickSeries(settings.series, kind, { export: false, b2b: true })
    return series ? formatSeriesNumber(series, fy, seq) : `${seq}`
  }
  const buyerPlace = placeOf('MH')
  const invoice = buildDocument({
    kind: kind === 'credit_note' ? 'tax_invoice' : kind,
    number: kind === 'tax_invoice' || kind === 'credit_note' ? numberFor('tax_invoice', 42) : null,
    issuedAt: now,
    order: {
      id: '00000000-0000-4000-8000-000000001042',
      number: 1042,
      placedAt: now,
      paymentMethod: kind === 'packing_slip' ? 'Cash on delivery' : 'UPI',
      collectPaise: kind === 'packing_slip' ? 3_67_900 : 0,
      shippingPaise: 9_900,
      discountPaise: 20_000,
      paymentAdjustmentPaise: 0,
      paymentAdjustmentLabel: null,
      totalPaise: 3_67_900,
      taxBreakdown: null,
    },
    lines: [
      {
        title: 'Handloom Cotton Kurta',
        variantTitle: 'Indigo / M',
        sku: 'KRT-IND-M',
        quantity: 2,
        unitPricePaise: 1_29_900,
        hsn: '62059090',
        ratePercent: 12,
        orderLineId: '00000000-0000-4000-8000-00000000c0a1',
      },
      {
        title: 'पीतल दीया सेट',
        variantTitle: 'Set of 4',
        sku: 'DIYA-4',
        quantity: 1,
        unitPricePaise: 1_18_200,
        hsn: '74181022',
        ratePercent: 18,
        orderLineId: diya,
      },
    ],
    seller: sellerParty(
      settings.seller.legalName || settings.seller.line1
        ? settings.seller
        : {
            ...settings.seller,
            legalName: storeName,
            line1: '14 Sector 29',
            city: 'Gurugram',
            stateCode: 'HR',
            pincode: '122001',
          },
      storeName,
    ),
    buyer: {
      name: 'Aarav Mehta',
      gstin: '27AAPFU0939F1ZV',
      address: ['402 Sea Breeze, Carter Road', 'Bandra West', 'Mumbai, Maharashtra, 400050'],
      state: buyerPlace,
      email: 'aarav@example.com',
      phone: '+91 98200 12345',
    },
    shipTo: null,
    placeOfSupply: buyerPlace,
    defaultHsn: settings.defaultHsn,
    hsnDigits: settings.hsnDigits,
    fallbackRatePercent: 18,
  })
  if (kind !== 'credit_note') return invoice
  // The diya set comes back and is refunded at what it was billed (its share of the discount
  // off), so the note credits that line alone, at 18%.
  return buildCreditNote({
    invoice,
    number: numberFor('credit_note', 3),
    issuedAt: now,
    amountPaise: invoice.lines.find((l) => l.orderLineId === diya)?.totalPaise ?? 0,
    reason: 'Returned: Brass diya set arrived damaged',
    returned: [{ orderLineId: diya, quantity: 1 }],
  })
}
