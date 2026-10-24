'use client'

import type { InboxWidget } from '@commerce/core/inbox'
import dynamic from 'next/dynamic'
import { type CSSProperties, useEffect, useState } from 'react'
import { inboxChatContent as copy } from '@/data/inbox'
import ChatIcon from './chat-icon'

type InboxLauncherProps = {
  widget: InboxWidget
  storeName: string
}

/** Set once this browser has chatted, so the chat loads on idle and shows replies. */
const ACTIVE_KEY = 'inbox:active'

/** Nothing of the chat loads until the shopper opens it (or has chatted before). */
const ChatWidget = dynamic(() => import('./chat-widget'), { ssr: false })

const BOTTOM = { lowest: '1rem', higher: '5.5rem', highest: '10rem' } as const

const wasActive = () => {
  try {
    return window.localStorage.getItem(ACTIVE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * The chat button (Shopify Inbox's activator): a small pill with an icon and "Chat", in the
 * merchant's colours, at the corner they picked in the theme editor. A plain button on the
 * server; the chat itself is a separate bundle loaded on the first click, or on idle when this
 * browser has chatted before. No cookie and no third party until the shopper sends a message.
 */
export default function InboxLauncher({ widget, storeName }: InboxLauncherProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!wasActive()) return
    // Load the chat once the page is idle (or after 2.5 s where idle callbacks do not exist).
    const timer = globalThis.setTimeout(() => setLoaded(true), 2500)
    return () => globalThis.clearTimeout(timer)
  }, [])

  // Event handlers
  const handleOpen = () => {
    setLoaded(true)
    setOpen(true)
  }

  // Render logic
  const label = widget.activatorLabel || copy.launcher
  const side =
    widget.horizontal === 'left'
      ? 'left-4'
      : widget.horizontal === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'right-4'
  const style = {
    bottom: `calc(${BOTTOM[widget.vertical]} + env(safe-area-inset-bottom))`,
    fontSize: `${widget.activatorFontSize / 16}rem`,
    borderRadius: `${Math.max(widget.borderRadius, 12) / 16}rem`,
    ...(widget.inheritFont ? { fontFamily: 'var(--font-body, inherit)' } : {}),
    ...(widget.invertActivator
      ? {
          background: widget.textColour || 'var(--color-bg, Canvas)',
          color: widget.background || 'var(--btn-bg, var(--color-ink, CanvasText))',
        }
      : {
          background: widget.background || 'var(--btn-bg, var(--color-ink, CanvasText))',
          color: widget.textColour || 'var(--btn-text, var(--color-bg, Canvas))',
        }),
  } as CSSProperties

  return (
    <>
      {open ? null : (
        <button
          type="button"
          aria-label={copy.open}
          onClick={handleOpen}
          style={style}
          className={`fixed z-40 flex touch-manipulation items-center gap-2 px-4 py-2.5 font-medium shadow-lg transition-[scale,opacity] duration-(--duration-press) ease-out active:scale-(--motion-press-scale) ${side}`}
        >
          {widget.activatorIcon === 'none' ? null : (
            <ChatIcon kind={widget.activatorIcon} className="size-5" />
          )}
          <span>{label}</span>
          {unread > 0 ? (
            <span className="ml-1 flex min-w-5 items-center justify-center rounded-full bg-[var(--color-bg,Canvas)] px-1.5 text-[0.75rem] text-[var(--color-ink,CanvasText)] tabular-nums">
              {unread}
            </span>
          ) : null}
        </button>
      )}
      {loaded ? (
        <ChatWidget
          open={open}
          widget={widget}
          storeName={storeName}
          onClose={() => setOpen(false)}
          onActive={() => {
            try {
              window.localStorage.setItem(ACTIVE_KEY, '1')
            } catch {
              // Private mode: the chat still works, it just loads on click next time.
            }
          }}
          onUnread={setUnread}
        />
      ) : null}
    </>
  )
}
