import { describeNotificationChannel, sampleTemplateData } from '@commerce/notifications/testing'
import { describe, expect, it } from 'vitest'
import { RESEND_API_URL, ResendChannel } from '../src'

/** A recorded `POST /emails`: the URL, headers and parsed JSON body. */
type Call = { url: string; headers: Record<string, string>; body: Record<string, unknown> }

/** A mocked fetch that records each request and answers with `reply` (never the network). */
function mockFetch(
  reply: { status: number; json?: unknown } | Error = { status: 200, json: { id: 'em_1' } },
) {
  const calls: Call[] = []
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({
      url: String(input),
      headers: init?.headers as Record<string, string>,
      body: JSON.parse(String(init?.body)),
    })
    if (reply instanceof Error) throw reply
    return new Response(reply.json === undefined ? 'not json' : JSON.stringify(reply.json), {
      status: reply.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
  return { calls, fetch: fn }
}

const config = {
  apiKey: 're_test_key',
  fromEmail: 'no-reply@mail.platform.test',
  fromName: 'Waimers',
}

describeNotificationChannel('resend', {
  create: () => new ResendChannel(config, { fetch: mockFetch().fetch }),
})

describe('ResendChannel.send', () => {
  it('posts the rendered email with From, To, bearer key and a template tag', async () => {
    const m = mockFetch()
    const r = await new ResendChannel(config, { fetch: m.fetch }).send({
      to: { email: 'shopper@example.com' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    expect(r).toEqual({ ok: true, providerRef: 'em_1' })
    const call = m.calls[0] as Call
    expect(call.url).toBe(`${RESEND_API_URL}/emails`)
    expect(call.headers.Authorization).toBe('Bearer re_test_key')
    expect(call.body.from).toBe('Waimers <no-reply@mail.platform.test>')
    expect(call.body.to).toEqual(['shopper@example.com'])
    expect(String(call.body.subject)).toContain(String(sampleTemplateData.orderNumber))
    expect(call.body.html).toBeTruthy()
    expect(call.body.text).toBeTruthy()
    expect(call.body.tags).toEqual([{ name: 'template', value: 'order_placed' }])
    expect(call.body).not.toHaveProperty('reply_to')
    expect(call.body).not.toHaveProperty('attachments')
  })

  it('sets reply_to and carries attachments as base64 with their type', async () => {
    const m = mockFetch()
    await new ResendChannel(
      { ...config, fromName: 'वाइमर्स', replyTo: 'support@shop.example' },
      { fetch: m.fetch },
    ).send({
      to: { email: 'shopper@example.com' },
      template: 'document_copy',
      data: { ...sampleTemplateData, documentLabel: 'tax invoice INV/1' },
      attachments: [
        { filename: 'inv.pdf', contentType: 'application/pdf', content: new Uint8Array([1, 2, 3]) },
      ],
    })
    const body = (m.calls[0] as Call).body
    expect(body.reply_to).toBe('support@shop.example')
    expect(body.attachments).toEqual([
      { filename: 'inv.pdf', content: 'AQID', content_type: 'application/pdf' },
    ])
    // Non-ASCII names go out as a MIME encoded-word, like SES.
    expect(String(body.from)).toMatch(/^=\?UTF-8\?B\?.+\?= <no-reply@mail\.platform\.test>$/)
  })

  it('reports a refused message as a plain failure (no fallback)', async () => {
    const m = mockFetch({
      status: 422,
      json: { statusCode: 422, name: 'validation_error', message: 'Invalid `to` field.' },
    })
    const r = await new ResendChannel(config, { fetch: m.fetch }).send({
      to: { email: 'shopper@example.com' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    expect(r).toEqual({ ok: false, error: 'Resend 422 validation_error: Invalid `to` field.' })
  })

  it.each([
    [{ status: 429, json: { name: 'rate_limit_exceeded', message: 'Too many requests' } }],
    [{ status: 429, json: { name: 'daily_quota_exceeded', message: 'Quota' } }],
    [{ status: 500, json: { name: 'internal_server_error', message: 'Oops' } }],
    [{ status: 503 }],
  ])('marks provider failures retryable (%j)', async (reply) => {
    const m = mockFetch(reply)
    const r = await new ResendChannel(config, { fetch: m.fetch }).send({
      to: { email: 'shopper@example.com' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    expect(r).toMatchObject({ ok: false, retryable: true })
  })

  it('never throws when the network is down, and says it may be retried elsewhere', async () => {
    const m = mockFetch(new TypeError('fetch failed'))
    const r = await new ResendChannel(config, { fetch: m.fetch }).send({
      to: { email: 'shopper@example.com' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    expect(r).toEqual({ ok: false, error: 'Resend unreachable: fetch failed', retryable: true })
  })

  it('treats a 200 without an id as a failure', async () => {
    const m = mockFetch({ status: 200, json: {} })
    const r = await new ResendChannel(config, { fetch: m.fetch }).send({
      to: { email: 'shopper@example.com' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    expect(r).toEqual({ ok: false, error: 'Resend returned no id' })
  })

  it('refuses a recipient without an email before calling Resend', async () => {
    const m = mockFetch()
    const r = await new ResendChannel(config, { fetch: m.fetch }).send({
      to: { phone: '919876543210' },
      template: 'order_placed',
      data: sampleTemplateData,
    })
    expect(r.ok).toBe(false)
    expect(m.calls).toHaveLength(0)
  })
})

describe('ResendChannel.sendMarketing', () => {
  it('sends the rendered campaign with its unsubscribe headers', async () => {
    const m = mockFetch()
    const r = await new ResendChannel(config, { fetch: m.fetch }).sendMarketing({
      kind: 'email',
      to: { email: 'shopper@example.com' },
      subject: 'Sale',
      html: '<p>Sale</p>',
      text: 'Sale',
      headers: [
        { name: 'List-Unsubscribe', value: '<https://shop.example/u/1>' },
        { name: 'List-Unsubscribe-Post', value: 'List-Unsubscribe=One-Click' },
      ],
    })
    expect(r).toEqual({ ok: true, providerRef: 'em_1' })
    const body = (m.calls[0] as Call).body
    expect(body.headers).toEqual({
      'List-Unsubscribe': '<https://shop.example/u/1>',
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    })
    expect(body.tags).toEqual([{ name: 'kind', value: 'marketing' }])
    expect(body.subject).toBe('Sale')
  })

  it('refuses WhatsApp templates and recipients without email', async () => {
    const m = mockFetch()
    const ch = new ResendChannel(config, { fetch: m.fetch })
    expect(
      await ch.sendMarketing({
        kind: 'whatsapp_template',
        to: { phone: '919876543210' },
        template: { name: 'x', language: 'en', variables: [] },
      }),
    ).toEqual({ ok: false, error: 'Resend only sends email' })
    expect(
      (await ch.sendMarketing({ kind: 'email', to: {}, subject: 's', html: 'h', text: 't' })).ok,
    ).toBe(false)
    expect(m.calls).toHaveLength(0)
  })
})

describe('ResendChannel identity', () => {
  it('takes the platform sender id and label when given', () => {
    const ch = new ResendChannel(config, { id: 'platform_email', label: 'Email (platform)' })
    expect(ch.id).toBe('platform_email')
    expect(ch.label).toBe('Email (platform)')
    expect(new ResendChannel(config).id).toBe('resend')
  })
})
