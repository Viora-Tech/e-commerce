import { describe, expect, it } from 'vitest'
import { WhatsappChannel } from '../src/whatsapp'

const config = {
  phoneNumberId: '1234567890',
  accessToken: 'offline-token',
  templateLanguage: 'en',
  useTextMessages: false,
}

type Call = { url: string; init: RequestInit }
const fakeFetch =
  (calls: Call[], reply: { status: number; body: unknown }) =>
  async (url: string, init: RequestInit) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(reply.body), { status: reply.status })
  }

const okReply = { status: 200, body: { messages: [{ id: 'wamid.1' }] } }

describe('whatsapp marketing sends', () => {
  it('sends a named approved template with its variables', async () => {
    const calls: Call[] = []
    const channel = new WhatsappChannel(config, fakeFetch(calls, okReply))
    const r = await channel.sendMarketing({
      kind: 'whatsapp_template',
      to: { phone: '+91 98765 43210' },
      template: { name: 'diwali_sale', language: 'en_US', variables: ['Asha', '20%\noff'] },
    })
    expect(r).toEqual({ ok: true, providerRef: 'wamid.1' })
    const body = JSON.parse((calls[0] as Call).init.body as string)
    expect(body.to).toBe('919876543210')
    expect(body.template.name).toBe('diwali_sale')
    expect(body.template.language.code).toBe('en_US')
    expect(body.template.components[0].parameters.map((p: { text: string }) => p.text)).toEqual([
      'Asha',
      '20% off',
    ])
    const email = await channel.sendMarketing({
      kind: 'email',
      to: { email: 'a@b.in' },
      subject: '',
      html: '',
      text: '',
    })
    expect(email.ok).toBe(false)
  })

  it('lists approved templates only, with their placeholder count', async () => {
    const calls: Call[] = []
    const reply = {
      status: 200,
      body: {
        data: [
          {
            name: 'diwali_sale',
            language: 'en',
            status: 'APPROVED',
            category: 'MARKETING',
            components: [{ type: 'BODY', text: 'Hi {{1}}, {{2}} off today. {{1}}!' }],
          },
          { name: 'draft_one', language: 'en', status: 'PENDING', components: [] },
        ],
      },
    }
    const channel = new WhatsappChannel(
      { ...config, businessAccountId: '555' },
      fakeFetch(calls, reply),
    )
    expect(await channel.listTemplates()).toEqual([
      {
        name: 'diwali_sale',
        language: 'en',
        category: 'MARKETING',
        status: 'APPROVED',
        body: 'Hi {{1}}, {{2}} off today. {{1}}!',
        variableCount: 2,
      },
    ])
    expect((calls[0] as Call).url).toContain('/555/message_templates')
    expect(await new WhatsappChannel(config, fakeFetch([], reply)).listTemplates()).toEqual([])
  })
})
