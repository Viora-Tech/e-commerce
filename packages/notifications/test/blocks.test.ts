import { describe, expect, it } from 'vitest'
import { renderEmail, TEMPLATE_IDS } from '../src'
import { sampleEmailBrand, sampleTemplateDataByTemplate } from '../src/testing'

/** The visible words of an email body, tags and spacing stripped. */
const words = (html: string) =>
  html
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')

describe('emails built from shared blocks', () => {
  it('every template renders its sample with no missing value showing', async () => {
    const broken: string[] = []
    for (const id of TEMPLATE_IDS) {
      const d = {
        ...sampleTemplateDataByTemplate[id],
        brand: { ...sampleEmailBrand, shopUrl: 'https://shop.example' },
      }
      const text = words((await renderEmail(id, d)).html)
      if (/undefined|NaN|\bnull\b/.test(text)) broken.push(id)
    }
    expect(broken).toEqual([])
  })

  it('side-by-side tiles colour their own cells, so a row of tiles is one height', async () => {
    const d = {
      ...sampleTemplateDataByTemplate.staff_new_order,
      paymentState: 'unpaid' as const,
      paymentMethodLabel: 'UPI or bank transfer',
    }
    const html = (await renderEmail('staff_new_order', d)).html
    const tiles = html.match(/<td class="k-stack"[^>]*>/g) ?? []
    const coloured = tiles.filter(
      (td) => td.includes('background-color') && td.includes('height:100%'),
    )
    expect(coloured).toHaveLength(2)
    expect(html).toContain('class="k-gap"')
    expect(html).toContain('.k-gap {')
  })

  it('delivery emails carry the route ticket with the courier and AWB', async () => {
    const d = sampleTemplateDataByTemplate.order_shipped
    const text = words((await renderEmail('order_shipped', d)).html)
    expect(text).toContain('Order #1042 · Shipped')
    expect(text).toContain('Kolkata')
    expect(text).toContain('Courier Delhivery')
    expect(text).toContain(`AWB ${d.waybill}`)
    expect(text).toContain('In this parcel')
  })

  it('a return ticket runs from the shopper back to the warehouse', async () => {
    const d = sampleTemplateDataByTemplate.return_requested
    const text = words((await renderEmail('return_requested', d)).html)
    expect(text).toContain('Pickup from Kolkata')
    expect(text).toContain('Back to New Delhi')
    expect(text).toContain('Waiting for approval')
  })

  it('the store message shows the note once, as a quote', async () => {
    const d = sampleTemplateDataByTemplate.customer_message
    const html = (await renderEmail('customer_message', d)).html
    const note = d.custom?.message ?? ''
    expect(html.split(note).length - 1).toBe(1)
  })

  it('app links still show under a block-built email', async () => {
    const d = {
      ...sampleTemplateDataByTemplate.order_shipped,
      links: [{ label: 'Download invoice', url: 'https://shop.example/inv.pdf' }],
    }
    expect((await renderEmail('order_shipped', d)).html).toContain('https://shop.example/inv.pdf')
  })
})
