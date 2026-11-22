import type { ChatEmail, ChatWaitingEmail } from './chat-types'
import type { TemplateData } from './types'

/** Samples for the Inbox chat emails (conformance suite, dev preview, admin preview). */
const chat: ChatEmail = {
  contactName: 'Asha',
  earlier: 0,
  messages: [
    {
      from: 'shopper',
      name: 'Asha',
      timeLabel: '10:42 am',
      text: 'Is the Maboroshi pad in stock in XL?',
    },
    {
      from: 'store',
      name: 'Waimers',
      timeLabel: '10:58 am',
      text: 'Yes, XL ships today if you order before 4 pm. Want me to hold one for you?',
    },
  ],
}

const chatWaiting: ChatWaitingEmail = {
  more: 0,
  threads: [
    {
      name: 'Asha',
      waitingLabel: 'Waiting 12 min',
      url: 'https://admin.example.com/sales-channels/inbox/conversations?id=sample',
      messages: [
        {
          from: 'shopper',
          name: 'Asha',
          timeLabel: '10:42 am',
          text: 'Is the Maboroshi pad in stock in XL?',
        },
      ],
    },
  ],
}

export function chatSamples(base: TemplateData) {
  const plain = {
    ...base,
    lines: [],
    totalLabel: '',
    orderNumber: undefined,
    taxBreakdown: undefined,
  }
  return {
    chat_reply: { ...plain, chat, actionUrl: 'https://waimers.in/?chat=open' },
    chat_transcript: { ...plain, chat, actionUrl: 'https://waimers.in/?chat=open' },
    staff_chat_waiting: {
      ...plain,
      chatWaiting,
      actionUrl: 'https://admin.example.com/sales-channels/inbox/conversations',
    },
  } satisfies Record<'chat_reply' | 'chat_transcript' | 'staff_chat_waiting', TemplateData>
}
