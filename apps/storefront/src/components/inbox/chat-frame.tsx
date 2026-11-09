'use client'

import type { InboxWidget } from '@commerce/core/inbox'
import { useEffect, useState } from 'react'
import { CHAT_ACTIVE_KEY, type ChatFrameMessage, chatMessageOf } from '@/lib/inbox-frame'
import { adoptPageLook } from '@/lib/inbox-frame-look'
import ChatWidget from './chat-widget'

type ChatFrameProps = {
  widget: InboxWidget
  storeName: string
  logoUrl: string | null
}

/** The `sm:` breakpoint, measured on the page around the frame. */
const WIDE_PX = 640

const post = (message: ChatFrameMessage) => {
  if (window.parent !== window) window.parent.postMessage(message, window.location.origin)
}

/** The page's path, for the message's page and the sign-in link's return. */
const pagePath = () => {
  try {
    return window.parent.location.pathname
  } catch {
    return '/'
  }
}

const parentWide = () => {
  try {
    return window.parent.innerWidth >= WIDE_PX
  } catch {
    return window.innerWidth >= WIDE_PX
  }
}

const handleUnread = (n: number) => post({ wcChat: 'unread', n })

const handleActive = () => {
  try {
    window.localStorage.setItem(CHAT_ACTIVE_KEY, '1')
  } catch {
    // Private mode: the chat still works, it just loads on tap next time.
  }
}

/**
 * The Inbox chat card inside the plain HTML page's chat frame (`lib/inbox-frame.ts`). The page
 * places, sizes and shows the frame; this draws the same `ChatWidget` the React pages use, filling
 * it, opens and closes when the page says so, and tells the page when the shopper closes it,
 * changes its size (float, docked, full screen) or has unread replies.
 */
export default function ChatFrame({ widget, storeName, logoUrl }: ChatFrameProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [wide, setWide] = useState(true)

  useEffect(() => {
    adoptPageLook()
    setOpen(window.location.hash === '#open')
    setWide(parentWide())
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return
      const message = chatMessageOf(event.data)
      if (message?.wcChat === 'open') setOpen(true)
      else if (message?.wcChat === 'close') setOpen(false)
    }
    const onResize = () => setWide(parentWide())
    window.addEventListener('message', onMessage)
    window.parent.addEventListener('resize', onResize)
    post({ wcChat: 'ready' })
    return () => {
      window.removeEventListener('message', onMessage)
      window.parent.removeEventListener('resize', onResize)
    }
  }, [])

  // Event handlers
  const handleClose = () => {
    setOpen(false)
    post({ wcChat: 'close' })
  }

  // Render logic
  return (
    <ChatWidget
      open={open}
      lift={0}
      widget={widget}
      storeName={storeName}
      logoUrl={logoUrl}
      onClose={handleClose}
      onActive={handleActive}
      onUnread={handleUnread}
      framed={{ onMode: (mode) => post({ wcChat: 'mode', mode }), pagePath, wide }}
    />
  )
}
