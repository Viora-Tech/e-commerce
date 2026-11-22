import { describe, expect, it } from 'vitest'
import { renderEmail } from '../src'
import { figmaInvoiceLink } from '../src/samples-order'
import { composeEmail } from '../src/templates/compose'
import { sampleEmailBrand, sampleTemplateDataByTemplate } from '../src/testing'
import type { TemplateData, TemplateId } from '../src/types'

const brand = { ...sampleEmailBrand, shopUrl: 'https://shop.example' }
const kinds = (id: TemplateId, d: TemplateData) =>
  composeEmail(id, d)?.blocks.map((b) => b.kind) ?? []

describe('WhatsApp us button', () => {
  it('payment received, order placed and shipped link the store number on wa.me with the logo', async () => {
    for (const id of ['payment_received', 'order_placed', 'order_shipped'] as const) {
      const d = { ...sampleTemplateDataByTemplate[id], brand }
      expect(kinds(id, d)).toContain('whatsapp')
      const { html } = await renderEmail(id, d)
      expect(html).toContain('https://wa.me/919876543210')
      expect(html).toContain('https://shop.example/email/whatsapp-green.png')
      expect(html).toContain('WhatsApp us')
      expect(html).not.toContain('.svg')
    }
  })

  it('hides when the store has no number', () => {
    const d = {
      ...sampleTemplateDataByTemplate.payment_received,
      brand: { ...brand, supportPhone: null },
    }
    expect(kinds('payment_received', d)).not.toContain('whatsapp')
  })

  it('shows the label alone without a shop address for the hosted logo', () => {
    const d = {
      ...sampleTemplateDataByTemplate.order_placed,
      brand: { supportPhone: '+91 98765 43210' },
    }
    const b = composeEmail('order_placed', d)?.blocks.find((x) => x.kind === 'whatsapp')
    expect(b).toMatchObject({ kind: 'whatsapp', url: 'https://wa.me/919876543210', logoSrc: null })
  })
})

describe('invoice in order emails', () => {
  it('payment received shows the invoice as a file with Download invoice, listed once', async () => {
    const d = { ...sampleTemplateDataByTemplate.payment_received, links: [figmaInvoiceLink] }
    const file = composeEmail('payment_received', d)?.blocks.find((b) => b.kind === 'attachment')
    expect(file).toMatchObject({
      name: 'Invoice for order #1042',
      link: { label: 'Download invoice', url: figmaInvoiceLink.url },
    })
    const { html, text } = await renderEmail('payment_received', d)
    expect(html.split(figmaInvoiceLink.url.replace(/&/g, '&amp;')).length - 1).toBe(1)
    expect(text).toContain(`Download invoice: ${figmaInvoiceLink.url}`)
  })

  it('order placed and shipped show it too; other app links stay as links', async () => {
    const other = { label: 'Write a review', url: 'https://shop.example/review' }
    for (const id of ['order_placed', 'order_shipped'] as const) {
      const d = { ...sampleTemplateDataByTemplate[id], links: [figmaInvoiceLink, other] }
      expect(kinds(id, d)).toContain('attachment')
      expect((await renderEmail(id, d)).html).toContain(other.url)
    }
  })

  it('no invoice link, no file', () => {
    const d = { ...sampleTemplateDataByTemplate.payment_received, links: undefined }
    expect(kinds('payment_received', d)).not.toContain('attachment')
  })
})
