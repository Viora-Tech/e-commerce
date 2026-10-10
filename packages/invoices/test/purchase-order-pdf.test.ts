import type { PurchaseOrderSheet } from '@commerce/core/inventory'
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { renderPurchaseOrderToBuffer } from '../src/pdf/render'

const party = (name: string) => ({
  name,
  gstin: null,
  address: ['Plot 4, Sector 18', 'Gurugram, Haryana, 122015'],
  email: null,
  phone: null,
})

const sheet: PurchaseOrderSheet = {
  number: 7,
  status: 'ordered',
  dateLabel: '10 Oct 2026',
  expectedLabel: '15 Nov 2026',
  currency: 'USD',
  buyer: { ...party('Waimers Retail Pvt Ltd'), gstin: '06ABCDE1234F1Z5' },
  shipTo: party('Gurugram warehouse'),
  supplier: { ...party('Shenzhen Pads'), email: 'sales@pads.example' },
  paymentTerms: '30% advance, rest before dispatch',
  note: 'Pack sleeves separately',
  lines: [
    {
      variantId: 'v1',
      title: 'Wireless pad / Black',
      sku: 'WP-BLK',
      hsnCode: '85044030',
      quantity: 100,
      unitPriceMinor: 840,
      totalMinor: 84_000,
    },
    {
      variantId: 'v2',
      title: 'Pad sleeve',
      sku: null,
      hsnCode: null,
      quantity: 200,
      unitPriceMinor: 200,
      totalMinor: 40_000,
    },
  ],
  units: 300,
  totalMinor: 124_000,
}

describe('purchase order PDF', () => {
  it('renders one A4 page titled with the order number', async () => {
    const bytes = await renderPurchaseOrderToBuffer(sheet)
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-')
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBe(1)
    expect(pdf.getTitle()).toBe('Purchase order PO7')
    expect(pdf.getAuthor()).toBe('Waimers Retail Pvt Ltd')
    const { width, height } = pdf.getPage(0).getSize()
    expect(Math.round(width)).toBe(595)
    expect(Math.round(height)).toBe(842)
  }, 30_000)

  it('prints Hindi and Chinese names and a long order over several pages', async () => {
    const lines = Array.from({ length: 60 }, (_, i) => ({
      variantId: `v${i}`,
      title: i % 2 ? `गेमिंग माउसपैड ${i}` : `鼠标垫 ${i}`,
      sku: `SKU-${i}`,
      hsnCode: null,
      quantity: 1,
      unitPriceMinor: 100,
      totalMinor: 100,
    }))
    const bytes = await renderPurchaseOrderToBuffer({
      ...sheet,
      currency: 'JPY',
      expectedLabel: null,
      paymentTerms: null,
      note: null,
      supplier: party('深圳供应商'),
      lines,
      units: 60,
      totalMinor: 6000,
    })
    const pdf = await PDFDocument.load(bytes)
    expect(pdf.getPageCount()).toBeGreaterThan(1)
  }, 30_000)
})
