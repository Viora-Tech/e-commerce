import { isValidElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { defaultInvoiceSettings, type InvoiceSettings, sampleDocument } from '../src'
import { renderDocumentToBuffer } from '../src/pdf/render'
import { documentElement, TEMPLATES } from '../src/templates'
import { stripItems } from '../src/templates/polish-head'
import { initials, mix, palette } from '../src/templates/polish-style'
import { templateView } from '../src/templates/view'

const settings: InvoiceSettings = {
  ...defaultInvoiceSettings,
  template: 'polish',
  accentColor: '#3730a3',
  terms: 'Returns within 7 days of delivery.',
  footer: 'Thank you for shopping handmade',
  signatoryName: 'Ritika Sharma',
}
const NOW = new Date('2026-06-01T00:00:00Z')
const assets = { logo: null, signature: null }

/** Every string in the element tree; the template's parts are hook-free functions. */
function collect(node: ReactNode, out: string[]): string[] {
  if (typeof node === 'string' || typeof node === 'number') out.push(String(node))
  else if (Array.isArray(node)) for (const n of node) collect(n, out)
  else if (isValidElement<{ children?: ReactNode }>(node)) {
    const { type, props } = node
    if (typeof type === 'function') collect((type as (p: unknown) => ReactNode)(props), out)
    else collect(props.children, out)
  }
  return out
}

/** What the template would print for a sample document, joined for `toContain`. */
function texts(kind: 'tax_invoice' | 'credit_note', s: InvoiceSettings = settings): string {
  const doc = sampleDocument(s, kind, 'Wmr', NOW)
  return collect(documentElement({ doc, settings: s, assets }), []).join('|')
}

describe('Polish (logo left) template', () => {
  it('is listed and selectable', () => {
    expect(TEMPLATES.polish.label).toBe('Logo left')
  })

  it('derives the Figma indigo tints from the accent', () => {
    const p = palette('#3730a3')
    expect(p.strip).toBe('#f1f1f9')
    expect(p.head).toBe('#e3e2f2')
    expect(p.onBandSoft).toBe('#cdcbe8')
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(initials('Saffron & Sage Studio')).toBe('S&S')
  })

  it('prints the tax invoice parts', () => {
    const t = texts('tax_invoice')
    expect(t).toContain(settings.footer)
    for (const s of [
      'Tax Invoice',
      'Original for recipient',
      'Invoice date',
      'Place of supply',
      'Bill to',
      'Customer GSTIN',
      '27AAPFU0939F1ZV',
      'Taxable value',
      'IGST',
      'Total GST',
      'Amount in words',
      'Ritika Sharma',
      'Authorised signatory',
    ]) {
      expect(t, s).toContain(s)
    }
  })

  it('prints the credit note against its invoice', () => {
    const t = texts('credit_note')
    expect(t).toContain('Credit Note')
    expect(t).toContain('Against invoice')
    expect(t).toContain('Returned: Brass diya set arrived damaged')
  })

  it('splits CGST and SGST for an intra-state sale', () => {
    const intra = {
      ...settings,
      seller: { ...settings.seller, legalName: 'Acme', stateCode: 'MH' },
    }
    const t = texts('tax_invoice', intra)
    expect(t).toContain('CGST')
    expect(t).toContain('SGST/UTGST')
  })

  it('moves the number to the band and splits order from its date', () => {
    const doc = sampleDocument(settings, 'tax_invoice', 'Wmr', NOW)
    const labels = stripItems(doc, templateView({ doc, settings, assets })).map((m) => m.label)
    expect(labels).not.toContain('Invoice no.')
    expect(labels.slice(0, 3)).toEqual(['Invoice date', 'Order', 'Order date'])
  })

  it('renders every document type to a PDF', async () => {
    const kinds = [
      'tax_invoice',
      'credit_note',
      'packing_slip',
      'order_confirmation',
      'receipt_voucher',
      'refund_voucher',
    ] as const
    for (const kind of kinds) {
      for (const paper of ['A4', 'A5'] as const) {
        const s = { ...settings, paper }
        const pdf = await renderDocumentToBuffer({
          doc: sampleDocument(s, kind, 'Wmr', NOW),
          settings: s,
          assets,
        })
        expect(new TextDecoder().decode(pdf.slice(0, 5)), `${kind} ${paper}`).toBe('%PDF-')
      }
    }
  }, 60_000)
})
