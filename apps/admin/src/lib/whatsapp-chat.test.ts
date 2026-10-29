import { describe, expect, it } from 'vitest'
import { whatsappChatContent as copy } from '@/data/whatsapp-chat'
import {
  chatLinkFor,
  chatTemplatesFor,
  chatVars,
  defaultChatTemplate,
  type WhatsappChatInfo,
} from './whatsapp-chat'

const base: WhatsappChatInfo = {
  phone: '9876543210',
  storeName: 'Waimers',
  customerName: 'Asha',
  orderNumber: 7,
  totalLabel: '₹1,500',
  waybill: null,
  links: {},
}

describe('click-to-chat templates', () => {
  it('offers only the messages whose link exists, blank always', () => {
    expect(chatTemplatesFor(base)).toEqual(['blank'])
    const unpaid = { ...base, links: { order: 'https://s/o', payment: 'https://s/o' } }
    expect(chatTemplatesFor(unpaid)).toEqual(['payment', 'order_confirmation', 'blank'])
    expect(defaultChatTemplate(unpaid)).toBe('payment')
    const shipped = { ...base, waybill: 'AWB1', links: { order: 'https://s/o' } }
    expect(chatTemplatesFor(shipped)).toEqual(['order_confirmation', 'shipping_update', 'blank'])
    expect(defaultChatTemplate(shipped)).toBe('shipping_update')
    const checkout = { ...base, orderNumber: null, links: { recovery: 'https://s/r' } }
    expect(defaultChatTemplate(checkout)).toBe('cart_recovery')
  })

  it('fills each message with the store, name and its own link', () => {
    const info = {
      ...base,
      waybill: 'AWB1',
      links: { payment: 'https://s/pay', tracking: 'https://track/1', recovery: 'https://s/r' },
    }
    expect(chatLinkFor('shipping_update', info)).toBe('https://track/1')
    expect(copy.messages.payment(chatVars('payment', info))).toBe(
      'Hi Asha, this is Waimers. Your order #7 of ₹1,500 is waiting for payment. You can pay here: https://s/pay',
    )
    const shipping = copy.messages.shipping_update(chatVars('shipping_update', info))
    expect(shipping).toContain('Tracking number: AWB1.')
    expect(shipping).toContain('https://track/1')
    const recovery = copy.messages.cart_recovery(
      chatVars('cart_recovery', { ...info, customerName: null }),
    )
    expect(recovery).toMatch(/^Hi there, .*Waimers.*https:\/\/s\/r$/)
    expect(copy.messages.blank(chatVars('blank', info))).toBe('')
  })
})
