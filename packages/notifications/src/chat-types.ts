/**
 * The Inbox chat emails: a shopper's copy of their chat with the store (a reply they have not
 * seen, or the whole chat once it is closed) and a team member's list of chats waiting for an
 * answer. Built by `@commerce/core` (inbox/chat-emails.ts) from the stored messages; the words
 * come from `templates/content-chat.ts`.
 */

/** One line of a chat as the email shows it: who wrote it, when, and what they wrote. */
export type ChatEmailMessage = {
  /** The shopper's own lines, or the store's (a team member or the AI agent). */
  from: 'shopper' | 'store'
  /** "Asha", or the store's name for its own lines. */
  name: string
  /** "10:42 am" or "21 Nov, 10:42 am", already in the store's time zone. */
  timeLabel: string
  /** The message text; a card (product, photo, discount) is a short label. */
  text: string
}

/** For chat_reply and chat_transcript. `actionUrl` is the link back to the chat. */
export type ChatEmail = {
  /** The shopper's name as they gave it; empty when they did not. */
  contactName: string
  messages: ChatEmailMessage[]
  /** Older messages left out of a long chat (0 when it is all there). */
  earlier: number
}

/** One chat in the team member's list. */
export type ChatWaitingThread = {
  /** The shopper's name, email or "A visitor". */
  name: string
  /** Their latest messages, oldest first (at most three). */
  messages: ChatEmailMessage[]
  /** "Waiting 12 min". */
  waitingLabel: string
  /** Opens the conversation in the admin. */
  url: string
}

/** For staff_chat_waiting. `actionUrl` opens the Inbox. */
export type ChatWaitingEmail = {
  threads: ChatWaitingThread[]
  /** Chats left out of a long list (0 when they are all there). */
  more: number
}
