import { describe, expect, it } from 'vitest'
import { defaultInvoiceSettings, type InvoiceSettings, sampleDocument } from '../src'
import { renderDocumentToBuffer } from '../src/pdf/render'

const KINDS = [
  'tax_invoice',
  'credit_note',
  'packing_slip',
  'order_confirmation',
  'receipt_voucher',
  'refund_voucher',
] as const

const d = defaultInvoiceSettings

/** Half-filled settings a merchant can be looking at while the preview redraws. */
const PARTIAL: Record<string, InvoiceSettings> = {
  'nothing filled in': d,
  'legal name only': { ...d, seller: { ...d.seller, legalName: 'Acme Traders' } },
  'address only': { ...d, seller: { ...d.seller, line1: '14 Sector 29' } },
  'empty default HSN at 8 digits': { ...d, defaultHsn: '', hsnDigits: 8 },
  'compact on A5': { ...d, template: 'compact', paper: 'A5' },
  minimal: { ...d, template: 'minimal' },
}

// The settings live preview renders `sampleDocument` with whatever the form holds; it must draw
// with partial settings and no logo or signature.
describe('settings preview render', () => {
  for (const [name, settings] of Object.entries(PARTIAL)) {
    it(`draws every document with ${name}`, async () => {
      for (const kind of KINDS) {
        const doc = sampleDocument(settings, kind, 'Wmr', new Date('2026-06-01T00:00:00Z'))
        const pdf = await renderDocumentToBuffer({
          doc,
          settings,
          assets: { logo: null, signature: null },
        })
        expect(new TextDecoder().decode(pdf.slice(0, 5)), kind).toBe('%PDF-')
      }
    }, 60_000)
  }
})
