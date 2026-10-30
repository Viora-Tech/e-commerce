import { describeNotificationChannel, sampleTemplateData } from '@commerce/notifications/testing'
import { describe, expect, it } from 'vitest'
import {
  buildPayload,
  GRAPH_API,
  templateParams,
  WhatsappChannel,
  whatsappFactory,
} from '../src/whatsapp'

const live = Boolean(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN)
const config = {
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '1234567890',
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN ?? 'offline-token',
  templateLanguage: 'en',
  useTextMessages: live,
}

type Call = { url: string; init: RequestInit }
const fakeFetch =
  (calls: Call[], reply: { status: number; body: unknown }) =>
  async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(reply.body), { status: reply.status })
  }

const okReply = { status: 200, body: { messages: [{ id: 'wamid.1' }] } }

describeNotificationChannel('whatsapp', {
  create: () =>
    live ? new WhatsappChannel(config) : new WhatsappChannel(config, fakeFetch([], okReply)),
  live,
  recipient: process.env.WHATSAPP_TEST_TO ? { phone: process.env.WHATSAPP_TEST_TO } : undefined,
})

describe('whatsapp specifics', () => {
  it('posts an approved template with body parameters', async () => {
    const calls: Call[] = []
    const r = await new WhatsappChannel(config, fakeFetch(calls, okReply)).send({
      to: { phone: '+91 98765 43210' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    expect(r).toEqual({ ok: true, providerRef: 'wamid.1' })
    const call = calls[0] as Call
    expect(call.url).toBe(`${GRAPH_API}/1234567890/messages`)
    expect((call.init.headers as Record<string, string>).authorization).toBe('Bearer offline-token')
    const body = JSON.parse(call.init.body as string)
    expect(body.to).toBe('919876543210')
    expect(body.type).toBe('template')
    expect(body.template.name).toBe('order_placed')
    expect(body.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual([
      'Asha',
      'Waimers',
      '42',
      '₹2,048',
    ])
  })

  it('sends plain text in test mode', () => {
    const p = buildPayload(
      { ...config, useTextMessages: true },
      { to: { phone: '1' }, template: 'payment_received', data: sampleTemplateData },
      '1',
    ) as { type: string; text: { body: string } }
    expect(p.type).toBe('text')
    expect(p.text.body).toContain('#42')
  })

  it('surfaces the Graph API error message', async () => {
    const r = await new WhatsappChannel(
      config,
      fakeFetch([], { status: 400, body: { error: { message: 'template not found' } } }),
    ).send({ to: { phone: '919876543210' }, template: 'order_placed', data: sampleTemplateData })
    expect(r).toEqual({ ok: false, error: 'template not found' })
  })

  it('maps every template to its placeholders', () => {
    expect(templateParams('order_shipped', sampleTemplateData)).toEqual(['Waimers', '42', '-'])
    expect(templateParams('payment_received', sampleTemplateData)).toHaveLength(3)
    expect(templateParams('order_edited', sampleTemplateData)).toEqual([
      'Asha',
      'Waimers',
      '42',
      '₹2,048',
      '-',
    ])
    expect(templateParams('shipping_update', sampleTemplateData)).toEqual([
      'Waimers',
      '42',
      '-',
      '-',
    ])
    expect(templateParams('order_link', sampleTemplateData)).toHaveLength(4)
    expect(templateParams('payment_pending', sampleTemplateData)).toHaveLength(5)
    expect(
      templateParams('return_exchanged', {
        ...sampleTemplateData,
        orderUrl: 'https://waimers.example/o/42',
        returnInfo: { label: 'R-3' },
      }),
    ).toEqual(['Waimers', 'R-3', '42', 'https://waimers.example/o/42'])
  })

  it('validates config and applies defaults', () => {
    expect(whatsappFactory.validateConfig({ phoneNumberId: 'abc' })).toMatchObject({ ok: false })
    const v = whatsappFactory.validateConfig({ phoneNumberId: '12', accessToken: 't' })
    expect(v).toEqual({
      ok: true,
      config: {
        phoneNumberId: '12',
        accessToken: 't',
        templateLanguage: 'en',
        useTextMessages: false,
      },
    })
  })
})
