import type { SendEmailCommand } from '@aws-sdk/client-sesv2'
import { describeNotificationChannel, sampleTemplateData } from '@commerce/notifications/testing'
import { describe, expect, it } from 'vitest'
import { formatFrom, SesChannel, sesFactory } from '../src/ses'

const live = Boolean(process.env.SES_ACCESS_KEY_ID && process.env.SES_SECRET_ACCESS_KEY)
const config = {
  region: process.env.SES_REGION ?? 'ap-south-1',
  accessKeyId: process.env.SES_ACCESS_KEY_ID ?? 'AKIAOFFLINE',
  secretAccessKey: process.env.SES_SECRET_ACCESS_KEY ?? 'offline',
  fromEmail: process.env.SES_FROM_EMAIL ?? 'orders@example.com',
  fromName: 'Waimers',
}

type Recorder = { sent: SendEmailCommand[]; fail?: Error }
const fakeClient = (rec: Recorder) => ({
  async send(cmd: SendEmailCommand) {
    if (rec.fail) throw rec.fail
    rec.sent.push(cmd)
    return { MessageId: 'msg-1' }
  },
})

describeNotificationChannel('ses', {
  create: () => (live ? new SesChannel(config) : new SesChannel(config, fakeClient({ sent: [] }))),
  live,
  recipient: process.env.SES_TEST_TO ? { email: process.env.SES_TEST_TO } : undefined,
})

describe('ses specifics', () => {
  it('sends subject, text and html to the recipient from the display name', async () => {
    const rec: Recorder = { sent: [] }
    const r = await new SesChannel(config, fakeClient(rec)).send({
      to: { email: 'asha@example.com' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    expect(r).toEqual({ ok: true, providerRef: 'msg-1' })
    const input = rec.sent[0]?.input
    expect(input?.FromEmailAddress).toBe('Waimers <orders@example.com>')
    expect(input?.Destination?.ToAddresses).toEqual(['asha@example.com'])
    expect(input?.Content?.Simple?.Subject?.Data).toContain('#42')
    expect(input?.Content?.Simple?.Body?.Html?.Data).toContain('Maboroshi mousepad')
  })

  it('attaches files and prints app links', async () => {
    const rec: Recorder = { sent: [] }
    const content = new Uint8Array([37, 80, 68, 70])
    await new SesChannel(config, fakeClient(rec)).send({
      to: { email: 'asha@example.com' },
      template: 'payment_received',
      data: {
        ...sampleTemplateData,
        links: [{ label: 'Download invoice', url: 'https://s.test/d/1' }],
      },
      attachments: [{ filename: 'INV-0001.pdf', contentType: 'application/pdf', content }],
    })
    const simple = rec.sent[0]?.input.Content?.Simple
    expect(simple?.Attachments).toEqual([
      {
        FileName: 'INV-0001.pdf',
        ContentType: 'application/pdf',
        RawContent: content,
        ContentDisposition: 'ATTACHMENT',
      },
    ])
    expect(simple?.Body?.Html?.Data).toContain('href="https://s.test/d/1"')
    expect(simple?.Body?.Text?.Data).toContain('Download invoice: https://s.test/d/1')
  })

  it('turns SDK errors into a failed result', async () => {
    const rec: Recorder = { sent: [], fail: new Error('MessageRejected') }
    const r = await new SesChannel(config, fakeClient(rec)).send({
      to: { email: 'asha@example.com' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    expect(r).toEqual({ ok: false, error: 'MessageRejected' })
  })

  it('formats the from header with and without a name', () => {
    expect(formatFrom({ ...config, fromName: undefined })).toBe('orders@example.com')
    expect(formatFrom(config)).toBe('Waimers <orders@example.com>')
  })

  it('validates required fields', () => {
    expect(sesFactory.validateConfig({})).toMatchObject({ ok: false })
    expect(sesFactory.validateConfig({ ...config, fromEmail: 'nope' })).toMatchObject({
      ok: false,
      errors: ['from address must be an email'],
    })
    expect(sesFactory.validateConfig(config)).toMatchObject({ ok: true })
  })
})

describe('ses bounce and complaint routing', () => {
  const routed = {
    ...config,
    configurationSetName: 'koomerce-events',
    tags: { 'store-id': '7d3c1c52-0b9e-4a52-9a43-2d3c64a1f0aa', 'bad tag!': 'x' },
  }

  it('names the configuration set and tags every send with the store', async () => {
    const rec: Recorder = { sent: [] }
    const channel = new SesChannel(routed, fakeClient(rec))
    await channel.send({
      to: { email: 'a@example.com' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    await channel.sendMarketing({
      kind: 'email',
      to: { email: 'a@example.com' },
      subject: 'Sale',
      html: '<p>Sale</p>',
      text: 'Sale',
    })
    expect(rec.sent).toHaveLength(2)
    for (const cmd of rec.sent) {
      expect(cmd.input.ConfigurationSetName).toBe('koomerce-events')
      // A tag SES would refuse is dropped rather than failing the send.
      expect(cmd.input.EmailTags).toEqual([
        { Name: 'store-id', Value: '7d3c1c52-0b9e-4a52-9a43-2d3c64a1f0aa' },
      ])
    }
  })

  it('leaves both out when not configured', async () => {
    const rec: Recorder = { sent: [] }
    await new SesChannel(config, fakeClient(rec)).send({
      to: { email: 'a@example.com' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    expect(rec.sent[0]?.input.ConfigurationSetName).toBeUndefined()
    expect(rec.sent[0]?.input.EmailTags).toBeUndefined()
  })
})
