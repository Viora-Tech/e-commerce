import { describe, expect, it } from 'vitest'
import {
  NotificationRegistry,
  renderEmail,
  renderWhatsapp,
  TEMPLATE_IDS,
  TEMPLATE_NAMES,
} from '../src'
import { sampleTemplateData } from '../src/testing'

describe('templates', () => {
  it.each(TEMPLATE_IDS)(
    '%s renders a subject, plain text and html with the store name',
    async (id) => {
      const e = await renderEmail(id, sampleTemplateData)
      expect(e.subject.length).toBeGreaterThan(0)
      expect(e.text.length).toBeGreaterThan(0)
      expect(e.text).toContain(sampleTemplateData.storeName)
      expect(e.html).toContain('<!DOCTYPE html')
      expect(e.html).toContain(sampleTemplateData.storeName)
      expect(TEMPLATE_NAMES[id].length).toBeGreaterThan(0)
      expect(renderWhatsapp(id, sampleTemplateData).text.length).toBeGreaterThan(0)
    },
  )

  it('order_placed carries the order number and item lines', async () => {
    const e = await renderEmail('order_placed', sampleTemplateData)
    expect(e.subject).toContain('#42')
    expect(e.text).toContain('Maboroshi mousepad x1, ')
    expect(e.html).toContain('Maboroshi mousepad')
    expect(renderWhatsapp('order_placed', sampleTemplateData).text).toContain('#42')
  })

  it('return messages name the return and say where the money went', async () => {
    const credit = await renderEmail('return_refunded', {
      ...sampleTemplateData,
      returnInfo: { label: 'R-3', refundLabel: '₹999', refundMethod: 'store_credit' },
    })
    expect(credit.subject).toContain('R-3')
    expect(credit.text).toContain('store credit')
    expect(credit.text).toContain('₹999')
    expect(credit.html).toContain('Return R-3')
    const original = await renderEmail('return_refunded', {
      ...sampleTemplateData,
      returnInfo: { label: 'R-3', refundLabel: '₹999', refundMethod: 'original' },
    })
    expect(original.text).not.toContain('store credit')
    const rejected = await renderEmail('return_rejected', {
      ...sampleTemplateData,
      returnInfo: { label: 'R-4', decisionNote: 'Item was used' },
    })
    expect(rejected.text).toContain('Item was used')
    const approved = renderWhatsapp('return_approved', {
      ...sampleTemplateData,
      returnInfo: { label: 'R-5', pickup: 'courier', pickupWaybill: 'RVP1' },
    })
    expect(approved.text).toContain('RVP1')
  })

  it('escapes shopper-supplied text in the html body', async () => {
    const e = await renderEmail('order_placed', { ...sampleTemplateData, customerName: '<b>x</b>' })
    expect(e.html).not.toContain('<b>x</b>')
    expect(e.html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })

  it('includes the tracking url when shipped', async () => {
    const e = await renderEmail('order_shipped', {
      ...sampleTemplateData,
      trackingUrl: 'https://t.example/1',
    })
    expect(e.text).toContain('https://t.example/1')
    expect(e.html).toContain('https://t.example/1')
  })

  it('shows the gift card code and balance, never a stray item list', async () => {
    const e = await renderEmail('gift_card_issued', {
      ...sampleTemplateData,
      giftCard: { code: 'ABCD-1234', balanceLabel: '₹1,000', message: 'Happy birthday' },
    })
    expect(e.html).toContain('ABCD-1234')
    expect(e.html).toContain('Happy birthday')
    expect(e.text).toContain('ABCD-1234')
  })

  it('renders a GST split when taxBreakdown is present', async () => {
    const e = await renderEmail('order_placed', {
      ...sampleTemplateData,
      taxBreakdown: [
        { label: 'CGST', amount: '₹90' },
        { label: 'SGST', amount: '₹90' },
      ],
    })
    expect(e.html).toContain('CGST')
    expect(e.html).toContain('SGST')
  })

  it('renders the one-time code for login_code', async () => {
    const e = await renderEmail('login_code', { ...sampleTemplateData, code: '482913' })
    expect(e.html).toContain('482913')
    expect(e.text).toContain('482913')
  })

  it('has plain text with no html tags', async () => {
    const e = await renderEmail('order_placed', sampleTemplateData)
    expect(e.text).not.toMatch(/<[a-z][\s\S]*>/i)
  })
})

describe('registry', () => {
  it('explains unknown channels and invalid config', () => {
    const r = new NotificationRegistry().register({
      id: 'x',
      label: 'X',
      fields: [],
      validateConfig: () => ({ ok: false, errors: ['nope'] }),
      create: () => {
        throw new Error('unreachable')
      },
    })
    expect(r.create('nope', {})).toEqual({
      ok: false,
      errors: ['unknown notification channel: nope'],
    })
    expect(r.create('x', {})).toEqual({ ok: false, errors: ['nope'] })
    expect(r.ids()).toEqual(['x'])
  })
})
