/**
 * The Inbox chat on a plain HTML page (docs/design/storefront-plain-html.md, phase 2). The page
 * draws the chat button itself (`lib/plain-html/chat-launcher.ts`) and, on the first tap, opens the
 * React chat card in a same-origin frame at `CHAT_FRAME_PATH` (`app/-c/[storeId]`), so the page
 * carries no React until a shopper asks to chat. The two sides talk with `postMessage`, always
 * checked against this origin, using the messages below.
 */

/** The public path of the chat frame; the proxy rewrites it to `/-c/<store>`. */
export const CHAT_FRAME_PATH = '/inbox/frame'

/** Set once this browser has chatted, so the chat loads on idle and shows replies. */
export const CHAT_ACTIVE_KEY = 'inbox:active'

/** The key every chat message carries, so other `message` events are ignored. */
export const CHAT_MESSAGE_KEY = 'wcChat'

/** Page → frame. */
export type ChatPageMessage = { wcChat: 'open' } | { wcChat: 'close' }

/** Frame → page. */
export type ChatFrameMessage =
  | { wcChat: 'ready' }
  | { wcChat: 'close' }
  | { wcChat: 'unread'; n: number }
  | { wcChat: 'mode'; mode: 'float' | 'expanded' | 'docked' }

/** A message from the other side of the chat frame, or null for anything else. */
export function chatMessageOf(data: unknown): ChatPageMessage | ChatFrameMessage | null {
  if (!data || typeof data !== 'object') return null
  const kind = (data as Record<string, unknown>)[CHAT_MESSAGE_KEY]
  return typeof kind === 'string' ? (data as ChatPageMessage | ChatFrameMessage) : null
}
