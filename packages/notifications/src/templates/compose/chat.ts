import type { ChatEmailMessage } from '../../chat-types'
import type { EmailBlock } from '../../emails/blocks'
import type { TemplateData, TemplateId } from '../../types'
import { chatWords as w } from '../content-chat'
import type { Composer } from './index'
import { muted, present } from './order'

/**
 * The Inbox chat emails, from shared blocks: each message is a quote box (the store's lines in
 * the accent colour, the shopper's plain), then one button back to the chat. The team's list
 * shows each waiting chat as a divider with its last messages and a Reply button.
 */
function quote(m: ChatEmailMessage): EmailBlock {
  return {
    kind: 'quote',
    label: w.lineLabel(m),
    text: m.text,
    ...(m.from === 'store' ? { tone: 'accent' as const } : {}),
  }
}

function chatBlocks(d: TemplateData, note: string): EmailBlock[] {
  const c = d.chat
  return present([
    c?.earlier ? muted(w.earlier(c.earlier)) : null,
    ...(c?.messages ?? []).map(quote),
    d.actionUrl ? { kind: 'button', label: w.continueChat, url: d.actionUrl } : null,
    muted(note),
  ])
}

const chatReply: Composer = (d) => ({
  eyebrow: w.replyKicker,
  blocks: chatBlocks(d, w.replyNote),
})

const chatTranscript: Composer = (d) => ({
  eyebrow: w.transcriptKicker,
  blocks: chatBlocks(d, w.transcriptNote),
})

const chatWaiting: Composer = (d) => {
  const list = d.chatWaiting
  return {
    eyebrow: w.waitingKicker,
    blocks: present([
      ...(list?.threads ?? []).flatMap((t): EmailBlock[] => [
        { kind: 'divider', label: `${t.name} · ${t.waitingLabel}` },
        ...t.messages.map(quote),
        { kind: 'button', label: w.reply, url: t.url },
      ]),
      list?.more ? muted(w.more(list.more)) : null,
      d.actionUrl && (list?.threads.length ?? 0) > 1
        ? { kind: 'button', label: w.openInbox, url: d.actionUrl }
        : null,
    ]),
  }
}

export const chatComposers: Partial<Record<TemplateId, Composer>> = {
  chat_reply: chatReply,
  chat_transcript: chatTranscript,
  staff_chat_waiting: chatWaiting,
}
