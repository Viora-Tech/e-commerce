import { describe, expect, it } from 'vitest'
import { renderEmail, renderWhatsapp, sampleTemplateDataByTemplate, TEMPLATE_IDS } from '../src'
import type { ChatWaitingThread } from '../src/chat-types'
import { composeEmail } from '../src/templates/compose'
import type { TemplateData } from '../src/types'

const reply = sampleTemplateDataByTemplate.chat_reply
const replyChat = reply.chat as NonNullable<TemplateData['chat']>
const waiting = sampleTemplateDataByTemplate.staff_chat_waiting

describe('Inbox chat emails', () => {
  it('are registered templates', () => {
    expect(TEMPLATE_IDS).toEqual(
      expect.arrayContaining(['chat_reply', 'chat_transcript', 'staff_chat_waiting']),
    )
  })

  it('chat_reply shows each message as a quote, the store in the accent, then the link back', () => {
    const c = composeEmail('chat_reply', reply)
    expect(c?.eyebrow).toBe('New reply')
    const quotes = c?.blocks.filter((b) => b.kind === 'quote') ?? []
    expect(quotes).toHaveLength(2)
    expect(quotes[0]).toMatchObject({
      label: 'Asha · 10:42 am',
      text: expect.stringContaining('XL'),
    })
    expect(quotes[0]).not.toHaveProperty('tone')
    expect(quotes[1]).toMatchObject({ label: 'Waimers · 10:58 am', tone: 'accent' })
    expect(c?.blocks).toContainEqual({
      kind: 'button',
      label: 'Continue the chat',
      url: 'https://waimers.in/?chat=open',
    })
  })

  it('says how many older messages a long chat leaves out', () => {
    const long: TemplateData = { ...reply, chat: { ...replyChat, earlier: 7 } }
    const c = composeEmail('chat_transcript', long)
    expect(c?.blocks[0]).toEqual({
      kind: 'text',
      muted: true,
      text: '7 earlier messages not shown.',
    })
  })

  it('renders the chat in the plain text and the html, escaping what the shopper wrote', async () => {
    const d: TemplateData = {
      ...reply,
      chat: {
        contactName: 'Asha',
        earlier: 0,
        messages: [{ from: 'shopper', name: 'Asha', timeLabel: '9:00 am', text: '<b>hi</b>' }],
      },
    }
    const out = await renderEmail('chat_reply', d)
    expect(out.subject).toBe('Waimers replied to your chat')
    expect(out.text).toContain('Asha (9:00 am): <b>hi</b>')
    expect(out.text).toContain('Continue the chat: https://waimers.in/?chat=open')
    expect(out.html).not.toContain('<b>hi</b>')
    expect(out.html).toContain('&lt;b&gt;hi&lt;/b&gt;')
  })

  it('the transcript has its own subject and greets a shopper with no name plainly', async () => {
    const d: TemplateData = { ...reply, chat: { ...replyChat, contactName: '' } }
    const out = await renderEmail('chat_transcript', d)
    expect(out.subject).toBe('Your chat with Waimers')
    expect(out.text.startsWith('Hi, here is a copy of your chat.')).toBe(true)
  })

  it('the team email lists each waiting chat with a Reply button, and counts the rest', async () => {
    const one = composeEmail('staff_chat_waiting', waiting)
    expect(one?.blocks).toContainEqual({ kind: 'divider', label: 'Asha · Waiting 12 min' })
    expect(one?.blocks.filter((b) => b.kind === 'button')).toHaveLength(1)
    expect((await renderEmail('staff_chat_waiting', waiting)).subject).toBe(
      'Asha is waiting for a reply in your chat',
    )

    const thread = (waiting.chatWaiting?.threads ?? [])[0] as ChatWaitingThread
    const many: TemplateData = {
      ...waiting,
      chatWaiting: { threads: [thread, { ...thread, name: 'Ravi' }], more: 3 },
    }
    const c = composeEmail('staff_chat_waiting', many)
    expect(c?.blocks).toContainEqual({
      kind: 'text',
      muted: true,
      text: 'And 3 more chats in the Inbox.',
    })
    expect(c?.blocks.at(-1)).toMatchObject({ kind: 'button', label: 'Open the Inbox' })
    const out = await renderEmail('staff_chat_waiting', many)
    expect(out.subject).toBe('5 chats are waiting for a reply')
    expect(out.text).toContain('Ravi (Waiting 12 min)')
  })

  it('has a WhatsApp line with the store and the link, though it goes by email', () => {
    expect(renderWhatsapp('chat_reply', reply).text).toContain('https://waimers.in/?chat=open')
  })
})
