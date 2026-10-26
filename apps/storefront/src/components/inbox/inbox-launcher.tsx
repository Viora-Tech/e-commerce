'use client'

import type { InboxWidget } from '@commerce/core/inbox'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { inboxChatContent as copy } from '@/data/inbox'
import { CHAT_GUARD, chatFontFamily } from '@/lib/inbox-guard'
import {
  bottomBars,
  CHAT_ROOT_ATTR,
  launcherBottom,
  launcherLift,
  overlayOver,
} from '@/lib/launcher-lift'
import ChatIcon from './chat-icon'

type InboxLauncherProps = {
  widget: InboxWidget
  storeName: string
  /** The store's logo for the chat header's avatar (`lib/inbox-logo.ts`). */
  logoUrl?: string | null | undefined
}

/** Set once this browser has chatted, so the chat loads on idle and shows replies. */
const ACTIVE_KEY = 'inbox:active'

/** Nothing of the chat loads until the shopper opens it (or has chatted before). */
const ChatWidget = dynamic(() => import('./chat-widget'), { ssr: false })

/** A late-painting theme bar (a dock its script draws) is measured again after this. */
const REMEASURE_MS = 1500

/**
 * The icon swap (chat <-> chevron): the outgoing icon turns 20deg, shrinks to 0.9 and fades
 * while the incoming one turns back in, 200ms on the strong ease-out. The turn and shrink are
 * `motion-safe`, so reduced motion is a plain cross-fade. `!` keeps theme CSS (`svg {...}`) out.
 */
const SWAP = 'transition-[opacity,scale,rotate]! duration-200! ease-out!'
const CHAT_OUT = 'opacity-0! motion-safe:-rotate-[20deg]! motion-safe:scale-90!'
const CHEVRON_OUT = 'opacity-0! motion-safe:rotate-[20deg]! motion-safe:scale-90!'

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
 * shopper sends a message. It lifts itself above any bar a theme pins to the bottom of the
 * window under it (a mobile dock, a sticky add-to-cart, the cookie banner), measured on load, on
 * resize and when the page's elements change (`lib/launcher-lift.ts`), and sits above the usual
 * theme layers (z-index 999), hiding while a theme overlay (a cart drawer) is open over it.
 */
export default function InboxLauncher({ widget, storeName, logoUrl }: InboxLauncherProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [unread, setUnread] = useState(0)
  const [lift, setLift] = useState(0)
  const [covered, setCovered] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const box = buttonRef.current?.getBoundingClientRect()
        // Hidden (the phone's full-screen chat is open): keep the last answer.
        if (!box || box.width === 0) return
        setLift(launcherLift(bottomBars(box), box, window.innerHeight))
        setCovered(overlayOver(box))
      })
    }
    measure()
    const late = globalThis.setTimeout(measure, REMEASURE_MS)
    // A dock drawn by a theme script, a cookie banner answered and removed, a drawer opened.
    const observer = new MutationObserver(measure)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'open', 'hidden'],
    })
    window.addEventListener('resize', measure)
    window.addEventListener('load', measure)
    return () => {
      cancelAnimationFrame(frame)
      globalThis.clearTimeout(late)
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('load', measure)
    }
  }, [])

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
  // On a phone the checkout's form and sticky Pay bar fill the screen; the button would cover a
  // field, so it waits off checkout pages there (desktop keeps it).
  const checkout = pathname.includes('/checkout')
  const side =
    widget.horizontal === 'left'
      ? 'left-4'
      : widget.horizontal === 'center'
        ? 'left-1/2 -translate-x-1/2'
        : 'right-4'
  const style = {
    bottom: `calc(${launcherBottom(widget.vertical, lift)})`,
    fontSize: `${widget.activatorFontSize / 16}rem`,
    fontFamily: chatFontFamily(widget.inheritFont),
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
      <button
        type="button"
        aria-label={open ? copy.close : copy.open}
        aria-expanded={open}
        onClick={handleToggle}
        ref={buttonRef}
        {...{ [CHAT_ROOT_ATTR]: '' }}
        style={style}
        className={`${CHAT_GUARD} fixed z-[999]! flex h-14 touch-manipulation items-center justify-center gap-2 rounded-full font-medium! shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_8px_24px_rgb(0_0_0/0.16)] transition-[scale,opacity]! duration-(--duration-press)! ease-out! active:scale-(--motion-press-scale)! ${pill ? 'px-5' : 'w-14'} ${open || checkout ? 'max-sm:hidden!' : ''} ${covered && !open ? 'invisible! opacity-0!' : ''} ${side}`}
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
                className={`absolute size-6 ${SWAP} ${open ? CHAT_OUT : ''}`}
              />
            )}
            <ChatIcon
              kind="chevronDown"
              className={`absolute size-6 ${SWAP} ${open ? '' : CHEVRON_OUT}`}
            />
          </span>
        )}
        {unread > 0 && !open ? (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-bg,Canvas)] px-1.5 text-[0.6875rem]! font-semibold! text-[var(--color-ink,CanvasText)] tabular-nums shadow-[0_0_0_1px_rgb(0_0_0/0.08)]">
            {unread}
          </span>
        ) : null}
      </button>
      {loaded ? (
        <ChatWidget
          open={open}
          lift={lift}
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
