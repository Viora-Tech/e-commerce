'use client'

import type { InboxWidget } from '@commerce/core/inbox'
import dynamic from 'next/dynamic'
import { type CSSProperties, useEffect, useState } from 'react'
import { inboxChatContent as copy } from '@/data/inbox'
import ChatIcon from './chat-icon'

type InboxLauncherProps = {
  widget: InboxWidget
  storeName: string
  /** The theme's logo, for the chat header's avatar. */
  logoUrl?: string | null | undefined
}

/** Set once this browser has chatted, so the chat loads on idle and shows replies. */
const ACTIVE_KEY = 'inbox:active'

/** Nothing of the chat loads until the shopper opens it (or has chatted before). */
const ChatWidget = dynamic(() => import('./chat-widget'), { ssr: false })

/** Same values as the card's offset in `chat-widget.tsx`, which sits just above this button. */
const BOTTOM = { lowest: '1rem', higher: '5.5rem', highest: '10rem' } as const

const wasActive = () => {
  try {
    return window.localStorage.getItem(ACTIVE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * The chat button: a round 3.5rem button in the merchant's colours (a pill when they set a
 * label), at the corner they picked in the theme editor. While the chat is open it turns into a
 * chevron that closes it (on a phone the chat is full screen and closes from its header). A
 * plain button on the server; the chat itself is a separate bundle loaded on the first click,
 * or on idle when this browser has chatted before. No cookie and no third party until the
 * shopper sends a message.
 */
export default function InboxLauncher({ widget, storeName, logoUrl }: InboxLauncherProps) {
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
  const handleToggle = () => {
    setLoaded(true)
    setOpen(!open)
  }

  // Render logic
  const label = widget.activatorLabel || (widget.activatorIcon === 'none' ? copy.launcher : '')
  const pill = Boolean(label) && !open
  const side =
    widget.horizontal === 'left'
      ? 'left-4'
      : widget.horizontal === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'right-4'
  const style = {
    bottom: `calc(${BOTTOM[widget.vertical]} + env(safe-area-inset-bottom))`,
    fontSize: `${widget.activatorFontSize / 16}rem`,
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
  const swap =
    'transition-[opacity,scale,rotate] duration-200 ease-out motion-reduce:transition-opacity'

  return (
    <>
      <button
        type="button"
        aria-label={open ? copy.close : copy.open}
        aria-expanded={open}
        onClick={handleToggle}
        style={style}
        className={`fixed z-40 flex h-14 touch-manipulation items-center justify-center gap-2 rounded-full font-medium shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_rgb(0_0_0/0.16)] transition-[scale,opacity] duration-(--duration-press) ease-out active:scale-(--motion-press-scale) ${pill ? 'px-5' : 'w-14'} ${open ? 'max-sm:hidden' : ''} ${side}`}
      >
        {pill ? (
          <>
            {widget.activatorIcon === 'none' ? null : (
              <ChatIcon kind={widget.activatorIcon} className="size-5" />
            )}
            <span>{label}</span>
          </>
        ) : (
          <span className="relative grid size-6 place-items-center">
            {widget.activatorIcon === 'none' ? null : (
              <ChatIcon
                kind={widget.activatorIcon}
                className={`absolute size-6 ${swap} ${open ? 'scale-(--motion-press-scale) -rotate-45 opacity-0' : ''}`}
              />
            )}
            <ChatIcon
              kind="chevronDown"
              className={`absolute size-6 ${swap} ${open ? '' : 'scale-(--motion-press-scale) rotate-45 opacity-0'}`}
            />
          </span>
        )}
        {unread > 0 && !open ? (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-bg,Canvas)] px-1.5 text-[0.6875rem] font-semibold text-[var(--color-ink,CanvasText)] tabular-nums shadow-[0_0_0_1px_rgb(0_0_0/0.08)]">
            {unread}
          </span>
        ) : null}
      </button>
      {loaded ? (
        <ChatWidget
          open={open}
          widget={widget}
          storeName={storeName}
          logoUrl={logoUrl}
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
