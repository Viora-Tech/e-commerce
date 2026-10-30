import { describe, expect, it } from 'vitest'
import {
  NotificationRegistry,
  PLATFORM_TEMPLATE_IDS,
  renderEmail,
  renderWhatsapp,
  sampleTemplateDataByTemplate,
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

  it('order_placed tells a manual transfer shopper how to pay', async () => {
    const paymentInstructions = ['UPI ID: shop@hdfcbank (Shop)', 'Reference: Order 42']
    const e = await renderEmail('order_placed', { ...sampleTemplateData, paymentInstructions })
    expect(e.text).toContain('UPI ID: shop@hdfcbank (Shop). Reference: Order 42.')
    expect(
      renderWhatsapp('order_placed', { ...sampleTemplateData, paymentInstructions }).text,
    ).toContain('shop@hdfcbank')
  })

  it('an order from two warehouses lists its parcels with dates; one parcel lists none', async () => {
    const parcels = [
      {
        from: 'Gurugram, Haryana',
        items: [{ title: 'Maboroshi mousepad', quantity: 1 }],
        dateRange: 'Tue, 13 Oct - Wed, 14 Oct',
        onHold: false,
      },
      {
        from: 'New Delhi, Delhi',
        items: [{ title: 'Hitscan Hyperlight / Black', quantity: 2 }],
        dateRange: null,
        onHold: true,
      },
    ]
    const split = await renderEmail('order_placed', { ...sampleTemplateData, parcels })
    expect(split.text).toContain('Ships in 2 parcels:')
    expect(split.text).toContain(
      'Parcel 1 from Gurugram, Haryana (Arrives Tue, 13 Oct - Wed, 14 Oct)',
    )
    expect(split.text).toContain(
      'Parcel 2 from New Delhi, Delhi (Pre-order: ships when it arrives)',
    )
    expect(split.text).toContain('- 2 × Hitscan Hyperlight / Black')
    expect(split.html).toContain('Ships in 2 parcels')
    expect(split.html).toContain('Parcel 2 from New Delhi, Delhi')
    const single = await renderEmail('order_placed', {
      ...sampleTemplateData,
      parcels: parcels.slice(0, 1),
    })
    expect(single.text).not.toContain('Ships in')
    expect(single.html).not.toContain('Ships in')
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

  it('return_exchanged names the return, both orders and the link, and lists the new items', async () => {
    const d = {
      ...sampleTemplateData,
      orderNumber: 57,
      orderUrl: 'https://waimers.example/account/orders/57',
      returnInfo: { label: 'R-3', originalOrderNumber: 42 },
    }
    const e = await renderEmail('return_exchanged', d)
    expect(e.subject).toContain('R-3')
    expect(e.text).toContain('order #57')
    expect(e.text).toContain('(order #42)')
    expect(e.text).toContain(d.orderUrl)
    expect(e.text).toContain(sampleTemplateData.lines[0]?.title ?? '')
    expect(e.html).toContain('Return R-3')
    expect(renderWhatsapp('return_exchanged', d).text).toContain('#57')
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

  it('staff_invite names the store, platform, inviter and role, with an accept button', async () => {
    const data = sampleTemplateDataByTemplate.staff_invite
    const e = await renderEmail('staff_invite', data)
    expect(e.subject).toBe("You're invited to manage Waimers on Koomerce")
    expect(e.text).toContain('owner@waimers.example invited you to help run Waimers as Staff.')
    expect(e.text).toContain('https://admin.koomerce.app/accept-invitation/sample')
    expect(e.text).toContain('expires in 2 days')
    expect(e.text).not.toContain('Items:')
    expect(e.html).toContain('Team invitation')
    expect(e.html).toContain('Accept invitation')
    expect(e.html).toContain('href="https://admin.koomerce.app/accept-invitation/sample"')
    expect(e.html).not.toContain('Maboroshi')
  })

  it('staff_invite reads well without a role and escapes the store name', async () => {
    const e = await renderEmail('staff_invite', {
      ...sampleTemplateDataByTemplate.staff_invite,
      storeName: '<i>Shop</i>',
      staffInvite: { inviterEmail: 'a@b.example', platformName: 'Koomerce' },
    })
    expect(e.text).toContain('a@b.example invited you to help run <i>Shop</i>. Accept')
    expect(e.html).not.toContain('<i>Shop</i>')
    expect(e.html).toContain('&lt;i&gt;Shop&lt;/i&gt;')
  })

  it('purchase_order names the order, lists its lines in the order currency and the merchant note', async () => {
    const data = sampleTemplateDataByTemplate.purchase_order
    const e = await renderEmail('purchase_order', data)
    expect(e.subject).toBe('Waimers: purchase order PO7')
    expect(e.text).toContain('Hello Shenzhen Pads')
    expect(e.text).toContain('Please find purchase order PO7 from Waimers attached (USD 1,240.00).')
    expect(e.text).toContain('We expect it to arrive by 15 Nov 2026.')
    expect(e.text).toContain('Wireless pad / Black x100, USD 840.00')
    expect(e.text).toContain('Please pack the sleeves separately. Please confirm the order')
    expect(e.text).not.toContain('View your order')
    expect(e.html).toContain('Purchase order PO7')
    expect(e.html).not.toContain('Maboroshi')
    expect(PLATFORM_TEMPLATE_IDS).not.toContain('purchase_order')
  })

  it('purchase_order reads well with no note and no arrival date', async () => {
    const data = sampleTemplateDataByTemplate.purchase_order
    const e = await renderEmail('purchase_order', {
      ...data,
      purchaseOrder: { numberLabel: 'PO8', supplierName: '' },
    })
    expect(e.text).toContain('Hello there')
    expect(e.text).toContain('attached (USD 1,240.00).\n')
    expect(e.text).not.toContain('expect it to arrive')
    expect(e.text).toContain('\nPlease confirm the order')
  })

  it('keeps platform templates out of the store message list', () => {
    expect(PLATFORM_TEMPLATE_IDS).toContain('staff_invite')
    expect(TEMPLATE_IDS).toContain('staff_invite')
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
