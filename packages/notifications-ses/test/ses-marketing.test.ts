import type { SendEmailCommand } from '@aws-sdk/client-sesv2'
import { describe, expect, it } from 'vitest'
import { SesChannel } from '../src/ses'

const config = {
  region: 'ap-south-1',
  accessKeyId: 'AKIAOFFLINE',
  secretAccessKey: 'offline',
  fromEmail: 'hello@example.com',
  fromName: 'Waimers',
}

const fakeClient = (sent: SendEmailCommand[], fail?: Error) => ({
  async send(cmd: SendEmailCommand) {
    if (fail) throw fail
    sent.push(cmd)
    return { MessageId: 'msg-1' }
  },
})

describe('ses marketing sends', () => {
  it('sends the rendered email with its unsubscribe headers', async () => {
    const sent: SendEmailCommand[] = []
    const r = await new SesChannel(config, fakeClient(sent)).sendMarketing({
      kind: 'email',
      to: { email: 'asha@example.com' },
      subject: 'Diwali drop',
      html: '<p>Hi</p>',
      text: 'Hi',
      headers: [{ name: 'List-Unsubscribe', value: '<https://shop.test/api/m/unsubscribe/t>' }],
    })
    expect(r).toEqual({ ok: true, providerRef: 'msg-1' })
    const simple = sent[0]?.input.Content?.Simple
    expect(simple?.Subject?.Data).toBe('Diwali drop')
    expect(simple?.Headers).toEqual([
      { Name: 'List-Unsubscribe', Value: '<https://shop.test/api/m/unsubscribe/t>' },
    ])
  })

  it('refuses WhatsApp sends and missing recipients, and reports transport errors', async () => {
    const channel = new SesChannel(config, fakeClient([]))
    const wa = await channel.sendMarketing({
      kind: 'whatsapp_template',
      to: { phone: '91' },
      template: { name: 'x', language: 'en', variables: [] },
    })
    expect(wa.ok).toBe(false)
    const none = await channel.sendMarketing({
      kind: 'email',
      to: {},
      subject: '',
      html: '',
      text: '',
    })
    expect(none.ok).toBe(false)
    const failing = new SesChannel(config, fakeClient([], new Error('throttled')))
    expect(
      await failing.sendMarketing({
        kind: 'email',
        to: { email: 'a@b.in' },
        subject: 's',
        html: '',
        text: '',
      }),
    ).toEqual({ ok: false, error: 'throttled' })
  })
})
