import type { ChatEmailMessage } from '../chat-types'
import type { TemplateData } from '../types'
import type { TemplateCopy } from './content-parts'

/**
 * The Inbox chat emails: the shopper's copy of a reply they missed or of the closed chat, and
 * the team member's list of chats waiting for an answer. The subject, the plain-text part and
 * the words the blocks show. Like every email word, English only.
 */
export const chatWords = {
  replyKicker: 'New reply',
  transcriptKicker: 'Your chat',
  waitingKicker: 'Inbox',
  continueChat: 'Continue the chat',
  openInbox: 'Open the Inbox',
  reply: 'Reply',
  earlier: (n: number) => `${n} earlier ${n === 1 ? 'message' : 'messages'} not shown.`,
  more: (n: number) => `And ${n} more ${n === 1 ? 'chat' : 'chats'} in the Inbox.`,
  replyNote: 'You can answer in the chat on the shop, or just reply to this email.',
  transcriptNote: 'Need anything else? Open the chat again on the shop any time.',
  /** "Asha · 10:42 am" over each message. */
  lineLabel: (m: ChatEmailMessage) => (m.timeLabel ? `${m.name} · ${m.timeLabel}` : m.name),
}

const greet = (d: TemplateData): string => {
  const name = d.chat?.contactName.trim()
  return name ? `Hi ${name}` : 'Hi'
}

const threadCount = (d: TemplateData): number =>
  (d.chatWaiting?.threads.length ?? 0) + (d.chatWaiting?.more ?? 0)

/** The chat as plain text lines: "Asha (10:42 am): Is this in stock?". */
export function chatText(messages: ChatEmailMessage[]): string {
  return messages
    .map((m) => `${m.name}${m.timeLabel ? ` (${m.timeLabel})` : ''}: ${m.text}`)
    .join('\n')
}

const linkLine = (label: string, url: string | undefined): string =>
  url ? `\n\n${label}: ${url}` : ''

/** The chat, then the link back to it, as the plain text's closing part. */
const chatOutro = (d: TemplateData, note: string): string => {
  const c = d.chat
  const earlier = c?.earlier ? `${chatWords.earlier(c.earlier)}\n` : ''
  return `${earlier}${chatText(c?.messages ?? [])}\n\n${note}${linkLine(chatWords.continueChat, d.actionUrl)}`
}

export const chatTemplates = {
  chat_reply: {
    subject: (d) => `${d.storeName} replied to your chat`,
    heading: (d) => `${greet(d)}, you have a reply.`,
    intro: (d) =>
      `${d.storeName} answered your message while you were away. Here is the chat so far.`,
    outro: (d) => chatOutro(d, chatWords.replyNote),
    whatsapp: (d) =>
      `${d.storeName} replied to your chat. Continue the chat here: ${d.actionUrl ?? ''}`,
  },
  chat_transcript: {
    subject: (d) => `Your chat with ${d.storeName}`,
    heading: (d) => `${greet(d)}, here is a copy of your chat.`,
    intro: (d) => `Your chat with ${d.storeName} is closed. Keep this email for your records.`,
    outro: (d) => chatOutro(d, chatWords.transcriptNote),
    whatsapp: (d) =>
      `Your chat with ${d.storeName} is closed. Open the chat again here: ${d.actionUrl ?? ''}`,
  },
  staff_chat_waiting: {
    subject: (d) => {
      const n = threadCount(d)
      const first = d.chatWaiting?.threads[0]?.name
      return n === 1 && first
        ? `${first} is waiting for a reply in your chat`
        : `${n} chats are waiting for a reply`
    },
    heading: (d) =>
      threadCount(d) === 1
        ? 'A shopper is waiting for a reply.'
        : 'Shoppers are waiting for a reply.',
    intro: (d) =>
      `Nobody on the ${d.storeName} team has answered ${threadCount(d) === 1 ? 'this chat' : 'these chats'} yet. A quick reply keeps the sale.`,
    outro: (d) => {
      const w = d.chatWaiting
      const threads = (w?.threads ?? []).map(
        (t) =>
          `${t.name} (${t.waitingLabel})\n${chatText(t.messages)}\n${chatWords.reply}: ${t.url}`,
      )
      const more = w?.more ? [chatWords.more(w.more)] : []
      return `${[...threads, ...more].join('\n\n')}${linkLine(chatWords.openInbox, d.actionUrl)}`
    },
    whatsapp: (d) =>
      `${d.storeName}: ${threadCount(d)} chat(s) are waiting for a reply. Open the Inbox: ${d.actionUrl ?? ''}`,
  },
} satisfies Record<'chat_reply' | 'chat_transcript' | 'staff_chat_waiting', TemplateCopy>
