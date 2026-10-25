/** SOURCE OF TRUTH: tests for the purchase order sheet's labels (PDF + supplier email) */
import { describe, expect, it } from 'vitest'
import {
  formatPurchaseAmount,
  type PurchaseOrderSheet,
  poDateLabel,
  poFilename,
  poNumberLabel,
  poSheetText,
} from './po-sheet'

describe('purchase order sheet labels', () => {
  it('numbers and names the file the way the admin shows the order', () => {
    expect(poNumberLabel(7)).toBe('PO7')
    expect(poFilename(12)).toBe('purchase-order-PO12.pdf')
  })

  it('formats amounts in the order currency with its full decimals', () => {
    expect(formatPurchaseAmount(12_345_678, 'INR')).toBe('₹1,23,456.78')
    expect(formatPurchaseAmount(0, 'INR')).toBe('₹0.00')
    expect(formatPurchaseAmount(124_050, 'USD')).toBe('USD 1,240.50')
    expect(formatPurchaseAmount(12_000, 'JPY')).toBe('JPY 12,000')
    expect(formatPurchaseAmount(5, 'CNY')).toBe('CNY 0.05')
  })

  it('prints dates in the store time zone', () => {
    // 20:00 UTC on 9 Oct is already 10 Oct in India.
    const at = new Date('2026-10-09T20:00:00Z')
    expect(poDateLabel(at, 'Asia/Kolkata')).toBe('10 Oct 2026')
    expect(poDateLabel(at, 'UTC')).toBe('9 Oct 2026')
  })

  it('gathers every printed text so the PDF can choose Hindi and Chinese fonts', () => {
    const party = (name: string, address: string[] = []) => ({
      name,
      gstin: null,
      address,
      email: null,
      phone: null,
    })
    const sheet: PurchaseOrderSheet = {
      number: 1,
      status: 'draft',
      dateLabel: '1 Oct 2026',
      expectedLabel: null,
      currency: 'CNY',
      buyer: party('वायमर्स'),
      shipTo: party('Gurugram', ['सेक्टर 18']),
      supplier: party('深圳供应商'),
      paymentTerms: 'Net 30',
      note: 'नोट',
      lines: [
        {
          variantId: 'v1',
          title: '鼠标垫',
          sku: null,
          hsnCode: null,
          quantity: 1,
          unitPriceMinor: 100,
          totalMinor: 100,
        },
      ],
      units: 1,
      totalMinor: 100,
    }
    const text = poSheetText(sheet)
    for (const part of ['वायमर्स', 'सेक्टर 18', '深圳供应商', 'Net 30', 'नोट', '鼠标垫']) {
      expect(text).toContain(part)
    }
  })
})
