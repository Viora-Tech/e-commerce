/** SOURCE OF TRUTH: printed document tests — WHAT: merge tags and the packing slip, pick list and invoice data / WHY: guard Settings › Printed documents */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TEMPLATES,
  DOCUMENT_KINDS,
  DocumentTemplateWriteSchema,
  invoiceData,
  packingSlipData,
  pickListData,
  printDocument,
  renderTemplate,
  SAMPLE_ORDER,
  SAMPLE_STORE,
  samplePreview,
  TEMPLATE_MAX_CHARS,
} from './templates'

describe('merge tags (audit #164)', () => {
  it('prints values, escaped, and nothing for unknown tags', () => {
    expect(renderTemplate('<b>{{ name }}</b>{{ missing }}', { name: 'A & <B>' })).toBe(
      '<b>A &amp; &lt;B&gt;</b>',
    )
    expect(renderTemplate('{{ a.b.c }}', { a: { b: { c: 7 } } })).toBe('7')
  })

  it('repeats a section for a list, shows it when set, and looks outward for names', () => {
    const data = { store: 'Waimers', lines: [{ title: 'Pad' }, { title: 'Skates' }] }
    expect(renderTemplate('{{#lines}}[{{ title }} at {{ store }}]{{/lines}}', data)).toBe(
      '[Pad at Waimers][Skates at Waimers]',
    )
    expect(renderTemplate('{{#note}}Note: {{ note }}{{/note}}', { note: 'Gift' })).toBe(
      'Note: Gift',
    )
    expect(renderTemplate('{{#note}}x{{/note}}{{^note}}none{{/note}}', { note: '' })).toBe('none')
    expect(renderTemplate('{{#shipTo}}{{ name }}{{/shipTo}}', { shipTo: { name: 'Asha' } })).toBe(
      'Asha',
    )
  })

  it('never lets order data add markup, and ignores a stray closing tag', () => {
    const out = renderTemplate('{{ v }}{{/nope}}', { v: '<img src=x onerror=alert(1)>' })
    expect(out).toBe('&lt;img src=x onerror=alert(1)&gt;')
  })
})

describe('document data', () => {
  it('fills a packing slip from an order', () => {
    const html = renderTemplate(
      DEFAULT_TEMPLATES.packing_slip,
      packingSlipData(SAMPLE_ORDER, SAMPLE_STORE),
    )
    expect(html).toContain('Order #1042')
    expect(html).toContain('Asha Rao')
    expect(html).toContain('Karnataka')
    expect(html).toContain('Glass mousepad, Black / XL')
    // "Default" variants are not printed.
    expect(html).not.toContain('Default')
  })

  it('adds up a pick list across orders, by SKU, with the orders each item goes to', () => {
    const data = pickListData([SAMPLE_ORDER, { ...SAMPLE_ORDER, number: 1043 }], SAMPLE_STORE)
    expect(data.orderCount).toBe(2)
    expect(data.itemCount).toBe(6)
    expect(data.items.map((i) => [i.sku, i.quantity, i.orders])).toEqual([
      ['GP-XL-BLK', 2, '#1042, #1043'],
      ['SK-01', 4, '#1042, #1043'],
    ])
  })

  it('leaves lines that need no shipping off the packing slip and pick list, not the invoice', () => {
    const service = {
      title: 'Fitting session',
      variantTitle: null,
      sku: 'SVC-1',
      quantity: 1,
      unitPricePaise: 50_000,
      requiresShipping: false,
    }
    const withService = { ...SAMPLE_ORDER, lines: [...SAMPLE_ORDER.lines, service] }
    const slip = renderTemplate(
      DEFAULT_TEMPLATES.packing_slip,
      packingSlipData(withService, SAMPLE_STORE),
    )
    expect(slip).not.toContain('Fitting session')
    expect(pickListData([withService], SAMPLE_STORE).items.map((i) => i.sku)).not.toContain('SVC-1')
    expect(invoiceData(withService, SAMPLE_STORE).lines.map((l) => l.title)).toContain(
      'Fitting session',
    )
  })

  it('prints totals on the invoice and leaves an empty discount out', () => {
    const html = renderTemplate(
      DEFAULT_TEMPLATES.invoice,
      packingSlipData({ ...SAMPLE_ORDER, discountPaise: 0 }, SAMPLE_STORE),
    )
    expect(html).toContain('₹2,438')
    expect(html).not.toContain('Discount')
  })

  it('puts each document on its own page and previews every kind', () => {
    const page = printDocument(['<p>a</p>', '<p>b</p>'], 'Slips')
    expect(page.match(/class="doc-page"/g)).toHaveLength(2)
    for (const kind of DOCUMENT_KINDS) {
      expect(samplePreview(kind, DEFAULT_TEMPLATES[kind], SAMPLE_STORE)).toContain('Your store')
    }
  })

  it('caps the template size', () => {
    const html = 'x'.repeat(TEMPLATE_MAX_CHARS + 1)
    expect(DocumentTemplateWriteSchema.safeParse({ kind: 'invoice', html }).success).toBe(false)
  })
})
