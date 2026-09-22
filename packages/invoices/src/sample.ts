import { buildCreditNote, buildDocument } from './document'
import { financialYear, formatDocumentNumber } from './numbering'
import { placeOf, sellerParty } from './parties'
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
  const fy = financialYear(now)
  const numberFor = (prefix: string, seq: number) =>
    formatDocumentNumber({ prefix, fy, seq, pad: settings.pad, includeFy: settings.includeFy })
  const buyerPlace = placeOf('MH')
  const invoice = buildDocument({
    kind: kind === 'credit_note' ? 'tax_invoice' : kind,
    number:
      kind === 'tax_invoice' || kind === 'credit_note'
        ? numberFor(settings.invoicePrefix, 42)
        : null,
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
      },
      {
        title: 'पीतल दीया सेट',
        variantTitle: 'Set of 4',
        sku: 'DIYA-4',
        quantity: 1,
        unitPricePaise: 1_18_200,
        hsn: '74181022',
        ratePercent: 18,
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
  return buildCreditNote({
    invoice,
    number: numberFor(settings.creditNotePrefix, 3),
    issuedAt: now,
    amountPaise: 1_18_200,
    reason: 'Returned: Brass diya set arrived damaged',
  })
}
