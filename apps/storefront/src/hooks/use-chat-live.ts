'use client'

import { connectInbox, type InboxConnectionEvent } from '@commerce/core/inbox'
import { useEffect, useRef } from 'react'

/**
 * The chat's live feed once the shopper has a conversation: `/inbox/stream` (SSE), falling back
 * to `/inbox/poll` every 4 s while the tab is visible (`connectInbox`). Each message once.
 */
export function useChatLive(
  conversationId: string | null,
  lastMessageId: string | null,
  onEvent: (event: InboxConnectionEvent) => void,
): void {
  const handler = useRef(onEvent)
  const last = useRef(lastMessageId)

  useEffect(() => {
    handler.current = onEvent
    last.current = lastMessageId
  })

  useEffect(() => {
    if (!conversationId) return
    const conn = connectInbox({
      initialAfterId: last.current,
      streamUrl: (after) => `/inbox/stream${after ? `?after=${encodeURIComponent(after)}` : ''}`,
      poll: async (after) => {
        const res = await fetch(
          `/inbox/poll${after ? `?after=${encodeURIComponent(after)}` : ''}`,
          {
            cache: 'no-store',
          },
        )
        if (!res.ok) return []
        const body = (await res.json()) as { events?: InboxConnectionEvent[] }
        return body.events ?? []
      },
      onEvent: (event) => handler.current(event),
      createEventSource: (url) => new EventSource(url),
      isActive: () => document.visibilityState === 'visible',
    })
    return () => conn.close()
  }, [conversationId])
}
