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
    expect(input?.Content?.Simple?.Body?.Html?.Data).toContain('<li>')
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
