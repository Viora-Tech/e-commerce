import { TEMPLATE_IDS } from '@commerce/notifications'
import { sampleTemplateData } from '@commerce/notifications/testing'
import { describe, expect, it } from 'vitest'
import { whatsappTemplateSpec, whatsappTemplateSpecs } from '../src/template-specs'
import { graphErrorMessage, templateSubmission } from '../src/templates-api'
import { GRAPH_API, templateParams, WhatsappChannel, whatsappFactory } from '../src/whatsapp'

const config = {
  phoneNumberId: '1234567890',
  accessToken: 'offline-token-SECRET',
  templateLanguage: 'en',
  useTextMessages: false,
  businessAccountId: '998877',
}

type Call = { url: string; init: RequestInit }
const fakeFetch =
  (calls: Call[], replies: { status: number; body: unknown }[]) =>
  async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    const reply = replies[Math.min(calls.length - 1, replies.length - 1)] as {
      status: number
      body: unknown
    }
    return new Response(JSON.stringify(reply.body), { status: reply.status })
  }

const placeholders = (body: string) => (body.match(/\{\{(\d+)\}\}/g) ?? []).map((p) => p)

describe('template specs', () => {
  it('writes every message body with each parameter exactly once, in the sender’s numbering', () => {
    for (const id of TEMPLATE_IDS) {
      if (id === 'customer_message') continue // email only: the merchant's own words
      const spec = whatsappTemplateSpec(id, 'Waimers')
      const count = templateParams(id, sampleTemplateData).length
      expect(spec.examples, id).toHaveLength(count)
      for (let n = 1; n <= count; n += 1) {
        expect(
          placeholders(spec.body).filter((p) => p === `{{${n}}}`),
          `${id} {{${n}}}`,
        ).toHaveLength(1)
      }
      // Meta refuses a body that starts or ends on a placeholder.
      expect(spec.body.startsWith('{{'), id).toBe(false)
      expect(spec.body.endsWith('}}'), id).toBe(false)
    }
  })

  it('takes the words from the WhatsApp copy and leaves sample-only details out', () => {
    expect(whatsappTemplateSpec('order_placed', 'Waimers')).toEqual({
      id: 'order_placed',
      name: 'order_placed',
      category: 'UTILITY',
      body: 'Hi {{1}}, {{2}} has received order #{{3}} for {{4}}. We will update you when it ships.',
      examples: ['Asha', 'Waimers', '42', '₹2,048'],
    })
    // The sample AWB is not a parameter of order_shipped, so it must not be fixed in the body.
    const shipped = whatsappTemplateSpec('order_shipped', 'Waimers')
    expect(shipped.body).not.toContain('AWB123456789')
    expect(shipped.body).toContain('Track: {{3}}')
    // A greeting is added for the shopper's name when the copy has none.
    expect(whatsappTemplateSpec('order_cancelled', 'Waimers').body).toMatch(/^Hi \{\{1\}\}, /)
  })

  it("fills the examples with the store's own name", () => {
    const spec = whatsappTemplateSpec('delivered', 'Chai Point')
    expect(spec.examples[0]).toBe('Chai Point')
  })

  it('marks code messages as Authentication', () => {
    expect(whatsappTemplateSpec('login_code', 'Waimers').category).toBe('AUTHENTICATION')
    expect(whatsappFactory.templateSpecs?.(['order_placed', 'login_code'], 'W')).toHaveLength(2)
    expect(whatsappTemplateSpecs(['delivered'], 'W')[0]?.id).toBe('delivered')
  })
})

describe('template statuses', () => {
  it('reads every page with the saved token and keeps Meta’s statuses', async () => {
    const calls: Call[] = []
    const channel = new WhatsappChannel(
      config,
      fakeFetch(calls, [
        {
          status: 200,
          body: {
            data: [
              { name: 'order_placed', language: 'en', status: 'APPROVED', category: 'UTILITY' },
            ],
            paging: { next: `${GRAPH_API}/998877/message_templates?after=abc` },
          },
        },
        {
          status: 200,
          body: {
            data: [
              {
                name: 'order_shipped',
                language: 'en',
                status: 'REJECTED',
                category: 'UTILITY',
                rejected_reason: 'INVALID_FORMAT',
              },
              { name: 'delivered', language: 'en', status: 'PENDING', rejected_reason: 'NONE' },
            ],
          },
        },
      ]),
    )
    const list = await channel.templateStatuses()
    expect(calls).toHaveLength(2)
    expect(calls[0]?.url).toContain(`${GRAPH_API}/998877/message_templates?`)
    expect(calls[0]?.url).not.toContain('SECRET')
    expect((calls[0]?.init.headers as Record<string, string> | undefined)?.authorization).toBe(
      'Bearer offline-token-SECRET',
    )
    expect(list).toEqual([
      {
        name: 'order_placed',
        language: 'en',
        status: 'APPROVED',
        category: 'UTILITY',
        rejectedReason: undefined,
      },
      {
        name: 'order_shipped',
        language: 'en',
        status: 'REJECTED',
        category: 'UTILITY',
        rejectedReason: 'INVALID_FORMAT',
      },
      {
        name: 'delivered',
        language: 'en',
        status: 'PENDING',
        category: '',
        rejectedReason: undefined,
      },
    ])
  })

  it('does not follow a next-page link off Meta’s Graph API', async () => {
    const calls: Call[] = []
    const channel = new WhatsappChannel(
      config,
      fakeFetch(calls, [
        { status: 200, body: { data: [], paging: { next: 'https://evil.example/steal' } } },
      ]),
    )
    await channel.templateStatuses()
    expect(calls).toHaveLength(1)
  })

  it("throws with Meta's message and needs the account ID", async () => {
    const channel = new WhatsappChannel(
      config,
      fakeFetch([], [{ status: 401, body: { error: { message: 'Invalid OAuth access token.' } } }]),
    )
    await expect(channel.templateStatuses()).rejects.toThrow('Invalid OAuth access token.')
    const noWaba = new WhatsappChannel(
      { ...config, businessAccountId: undefined },
      fakeFetch([], []),
    )
    await expect(noWaba.templateStatuses()).rejects.toThrow(/Business Account ID/)
  })
})

describe('submitting a template', () => {
  it('posts a Utility template with numbered placeholders and examples', async () => {
    const calls: Call[] = []
    const channel = new WhatsappChannel(
      config,
      fakeFetch(calls, [
        { status: 200, body: { id: '1', status: 'PENDING', category: 'UTILITY' } },
      ]),
    )
    const spec = whatsappTemplateSpec('order_placed', 'Waimers')
    expect(await channel.submitTemplate(spec)).toEqual({ status: 'PENDING' })
    expect(calls[0]?.url).toBe(`${GRAPH_API}/998877/message_templates`)
    expect(calls[0]?.init.method).toBe('POST')
    expect(JSON.parse(calls[0]?.init.body as string)).toEqual({
      name: 'order_placed',
      language: 'en',
      category: 'UTILITY',
      components: [
        {
          type: 'BODY',
          text: spec.body,
          example: { body_text: [['Asha', 'Waimers', '42', '₹2,048']] },
        },
      ],
    })
  })

  it("gives Meta's user-facing reason when it refuses", async () => {
    const channel = new WhatsappChannel(
      config,
      fakeFetch(
        [],
        [
          {
            status: 400,
            body: {
              error: {
                message: 'Invalid parameter',
                error_user_title: 'Template name already exists',
                error_user_msg: 'Pick another name.',
              },
            },
          },
        ],
      ),
    )
    await expect(
      channel.submitTemplate(whatsappTemplateSpec('delivered', 'Waimers')),
    ).rejects.toThrow('Template name already exists: Pick another name.')
  })

  it('leaves code templates to WhatsApp Manager', async () => {
    const calls: Call[] = []
    const channel = new WhatsappChannel(config, fakeFetch(calls, []))
    await expect(
      channel.submitTemplate(whatsappTemplateSpec('login_code', 'Waimers')),
    ).rejects.toThrow(/WhatsApp Manager/)
    expect(calls).toHaveLength(0)
  })

  it('formats errors and the submission body without the token', () => {
    expect(graphErrorMessage(undefined, 500)).toBe('HTTP 500')
    const body = templateSubmission(whatsappTemplateSpec('delivered', 'W'), 'en_US')
    expect(body.language).toBe('en_US')
    expect(JSON.stringify(body)).not.toContain('token')
  })
})
