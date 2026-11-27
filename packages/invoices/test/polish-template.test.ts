import { isValidElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { defaultInvoiceSettings, type InvoiceSettings, sampleDocument } from '../src'
import { renderDocumentToBuffer } from '../src/pdf/render'
import { documentElement, TEMPLATES } from '../src/templates'
import { stripItems } from '../src/templates/polish-meta'
import { logoMonogram, palette } from '../src/templates/polish-style'
import { rupeeRows } from '../src/templates/polish-totals'
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
    expect(palette('#000000').onBandSoft).toBe('#bfbfbf')
    expect(logoMonogram('Saffron & Sage Studio')).toBe('S&S')
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
      'Subtotal',
      'Shipping',
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
    expect(t).toContain('Total GST')
  })

  it('totals as the Figma frame: goods subtotal, discount, charges, then tax', () => {
    const doc = sampleDocument(settings, 'tax_invoice', 'Wmr', NOW)
    const rows = rupeeRows(doc, templateView({ doc, settings, assets }))
    const labels = rows.map((r) => r.label)
    expect(labels).toEqual(['Subtotal', 'Discount', 'Shipping', 'Taxable value', 'IGST'])
    // Inter-state: IGST is already the one GST figure, so no Total GST row.
    expect(labels).not.toContain('Total GST')
    const paise = (v: string) => Math.round(Number(v.replace(/[^0-9.]/g, '')) * 100)
    const [sub, disc, ship] = rows.map((r) => paise(r.value))
    expect((sub ?? 0) - (disc ?? 0) + (ship ?? 0)).toBe(doc.totals.totalPaise)
  })

  it('says Shipping Free when a shipped order has no shipping charge', () => {
    const doc = sampleDocument(settings, 'tax_invoice', 'Wmr', NOW)
    const free = {
      ...doc,
      lines: doc.lines.filter((l) => !l.charge),
      shipTo: doc.buyer,
    }
    const rows = rupeeRows(free, templateView({ doc: free, settings, assets }))
    expect(rows).toContainEqual({ label: 'Shipping', value: 'Free' })
  })

  it('moves the number to the band and splits order from its date', () => {
    const doc = sampleDocument(settings, 'tax_invoice', 'Wmr', NOW)
    const labels = stripItems(doc, templateView({ doc, settings, assets })).map((m) => m.label)
    expect(labels).not.toContain('Invoice no.')
    expect(labels.slice(0, 3)).toEqual(['Invoice date', 'Order', 'Order date'])
  })

  it('lists the other Figma frames as their own templates', () => {
    expect(TEMPLATES['polish-centre'].label).toBe('Logo centre')
    expect(TEMPLATES['polish-right'].label).toBe('Logo right')
    expect(TEMPLATES['polish-minimal'].label).toBe('White header')
    for (const template of ['polish-centre', 'polish-right', 'polish-minimal'] as const) {
      const t = texts('tax_invoice', { ...settings, template })
      for (const s of ['Tax Invoice', 'Original for recipient', 'Customer GSTIN', 'Subtotal']) {
        expect(t, `${template} ${s}`).toContain(s)
      }
      expect(t, template).toContain('Ritika Sharma')
    }
  })

  it('renders the other layouts to a PDF on A4 and A5', async () => {
    for (const template of ['polish-centre', 'polish-right', 'polish-minimal'] as const) {
      for (const kind of ['tax_invoice', 'credit_note', 'packing_slip'] as const) {
        for (const paper of ['A4', 'A5'] as const) {
          const s = { ...settings, template, paper }
          const pdf = await renderDocumentToBuffer({
            doc: sampleDocument(s, kind, 'Wmr', NOW),
            settings: s,
            assets,
          })
          expect(new TextDecoder().decode(pdf.slice(0, 5)), `${template} ${kind}`).toBe('%PDF-')
        }
      }
    }
  }, 60_000)

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
