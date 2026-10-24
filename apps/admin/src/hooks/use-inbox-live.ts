'use client'

import { connectInbox, type InboxConnectionEvent } from '@commerce/core/inbox'
import { useEffect, useRef } from 'react'
import { api } from '@/lib/api-client'

/**
 * The admin inbox's live feed: the store's SSE stream (`/api/inbox/stream`), falling back to
 * `inbox.sync` every 4 s while the tab is visible when the stream does not get through
 * (`connectInbox`). Each message reaches `onEvent` once.
 */
export function useInboxLive(onEvent: (event: InboxConnectionEvent) => void): void {
  const handler = useRef(onEvent)

  useEffect(() => {
    handler.current = onEvent
  })

  useEffect(() => {
    // The poll keeps its own cursor so it starts from "now" even before any message arrives.
    let cursor: string | null = null
    const conn = connectInbox({
      streamUrl: (after) =>
        `/api/inbox/stream${after ? `?after=${encodeURIComponent(after)}` : ''}`,
      poll: async (after) => {
        const r = await api.inbox.sync({ since: after ?? cursor })
        cursor = r.cursor
        return [
          ...r.messages.map((message) => ({
            type: 'message',
            conversationId: message.conversationId,
            message,
          })),
          ...r.conversations.map((c) => ({
            type: 'conversation',
            conversationId: c.id,
            status: c.status,
            unreadStaff: c.unreadStaff,
          })),
        ]
      },
      onEvent: (event) => handler.current(event),
      createEventSource: (url) => new EventSource(url),
      isActive: () => document.visibilityState === 'visible',
    })
    return () => conn.close()
  }, [])
}
