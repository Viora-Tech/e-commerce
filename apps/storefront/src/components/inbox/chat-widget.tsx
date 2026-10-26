'use client'

import type { InboxConnectionEvent, InboxWidget } from '@commerce/core/inbox'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { inboxChatContent as copy } from '@/data/inbox'
import { useChatLive } from '@/hooks/use-chat-live'
import {
  type ChatState,
  chatCardsAction,
  chatSeenAction,
  chatStateAction,
  chatTypingAction,
  sendChatAction,
} from '@/lib/inbox-actions'
import { CHAT_GUARD, chatFontFamily } from '@/lib/inbox-guard'
import ChatComposer from './chat-composer'
import ChatContactForm from './chat-contact-form'
import ChatHeader, { type ChatMode } from './chat-header'
import ChatIntro from './chat-intro'
import ChatMessage, { type ChatMessageView } from './chat-message'
import ChatTrack from './chat-track'

type ChatWidgetProps = {
  open: boolean
  widget: InboxWidget
  storeName: string
  /** The store's logo for the header avatar (`lib/inbox-logo.ts`); its first letter without one. */
  logoUrl?: string | null | undefined
  onClose: () => void
  /** The shopper sent a message: the chat should load on idle next time. */
  onActive: () => void
  /** Staff replies the shopper has not seen while the chat is closed. */
  onUnread: (n: number) => void
}

type Contact = { name: string; email: string; phone: string }

const TYPING_EVERY_MS = 3000
const TYPING_SHOWN_MS = 5000

/** The launcher's distance from the bottom (same values as `inbox-launcher.tsx`). */
const BOTTOM = { lowest: '1rem', higher: '5.5rem', highest: '10rem' } as const
/** The launcher's 3.5rem plus the gap between it and the card. */
const ABOVE_LAUNCHER = '4.25rem'

/**
 * Open and close. The card grows from the launcher's corner (0.96 and 8px below, with the fade)
 * in 220ms and goes back the same way in 160ms; a phone's full-screen card rises from the bottom
 * edge as a sheet (`--duration-drawer`, `--ease-drawer`) and drops back in 70% of that. It stays
 * mounted while closed (invisible, inert), so both ways are CSS transitions that retarget when
 * the shopper toggles mid-way; the first open, when the card mounts, starts from
 * `@starting-style`. Transforms are `motion-safe` only, so reduced motion keeps the fade. Every
 * class is `!`: an imported theme's unlayered CSS beats Tailwind's layered utilities.
 */
const PANEL_MOTION =
  'transition-[opacity,scale,translate,visibility]! ease-out! max-sm:ease-(--ease-drawer)!'
const PANEL_OPEN =
  'visible! opacity-100! duration-[220ms]! max-sm:duration-(--duration-drawer)! starting:opacity-0! sm:motion-safe:starting:scale-[0.96]! sm:motion-safe:starting:translate-y-2! max-sm:motion-safe:starting:translate-y-full!'
const PANEL_CLOSED =
  'pointer-events-none invisible! opacity-0! duration-[160ms]! max-sm:duration-[245ms]! sm:motion-safe:scale-[0.96]! sm:motion-safe:translate-y-2! max-sm:motion-safe:translate-y-full!'

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Adds a message once by id (or replaces the optimistic copy with the same client id). */
function merge(list: ChatMessageView[], m: ChatMessageView): ChatMessageView[] {
  if (list.some((x) => x.id === m.id)) return list
  const rest = m.clientId ? list.filter((x) => !(x.pending && x.clientId === m.clientId)) : list
  return [...rest, m].sort(byId)
}

/**
 * Per message: whether it starts a run from its sender (the "Assistant" label, the staff
 * avatar) and whether a person took over from the assistant with it (the "joined" divider).
 */
function threadMeta(list: ChatMessageView[]) {
  const meta = new Map<string, { first: boolean; joined: boolean }>()
  let prev: string | null = null
  let lastReply: string | null = null
  for (const m of list) {
    if (m.kind === 'cart_event') continue
    const joined = m.sender === 'staff' && lastReply === 'ai'
    meta.set(m.id, { first: joined || m.sender !== prev, joined })
    prev = m.sender
    if (m.sender === 'ai' || m.sender === 'staff') lastReply = m.sender
  }
  return meta
}

/** A short soft tone for a new reply, when the store turned sounds on. */
function chime() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.06, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
  } catch {
    // No audio (autoplay rules): the reply still shows.
  }
}

/**
 * The chat card: a clean rounded panel above the launcher (full screen on a phone) with the
 * store's avatar and online status, full screen, dock to the side and minimise; the intro with
 * Quick help and popular products; the thread with product and code cards, photos, cart lines
 * and the in-chat order tracking; and the "Ask anything…" field.
 */
export default function ChatWidget({
  open,
  widget,
  storeName,
  logoUrl,
  onClose,
  onActive,
  onUnread,
}: ChatWidgetProps) {
  // Hooks
  const [state, setState] = useState<ChatState | null>(null)
  const [messages, setMessages] = useState<ChatMessageView[]>([])
  const [cards, setCards] = useState<ChatState['cards']>({ products: {}, discounts: {} })
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [staffSeen, setStaffSeen] = useState<string | null>(null)
  const [mode, setMode] = useState<ChatMode>('float')
  const [notice, setNotice] = useState<string | null>(null)
  const [contact, setContact] = useState<Contact | null | undefined>(undefined)
  const [typingAt, setTypingAt] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [unread, setUnread] = useState(0)
  const [tracking, setTracking] = useState(false)
  const lastTyping = useRef(0)
  const bottomRef = useRef<HTMLDivElement>(null)

  useChatLive(conversationId, messages.at(-1)?.id ?? null, (event: InboxConnectionEvent) => {
    if (event.type === 'message') {
      const m = event.message as ChatMessageView
      setMessages((list) => merge(list, m))
      if (m.sender !== 'shopper') {
        setTypingAt(0)
        if (!open) setUnread((n) => n + 1)
        if (state?.sound) chime()
        if (m.kind === 'product' || m.kind === 'discount') {
          chatCardsAction([{ kind: m.kind, payload: m.payload }])
            .then((c) =>
              setCards((old) => ({
                products: { ...old.products, ...c.products },
                discounts: { ...old.discounts, ...c.discounts },
              })),
            )
            .catch(() => undefined)
        }
        if (open) chatSeenAction().catch(() => undefined)
      }
    } else if (event.type === 'typing') {
      setTypingAt(Date.now())
    } else if (event.type === 'seen' && event.by === 'staff') {
      setStaffSeen(typeof event.messageId === 'string' ? event.messageId : null)
    }
  })

  useEffect(() => {
    let alive = true
    chatStateAction().then((s) => {
      if (!alive || !s) return
      setState(s)
      if (s.thread) {
        setMessages(s.thread.messages)
        setConversationId(s.thread.conversation.id)
        setStaffSeen(s.thread.conversation.staffSeenMessageId)
        setUnread(s.thread.conversation.unreadShopper)
        if (s.thread.conversation.hasContact) setContact(null)
      }
      setCards(s.cards)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    onUnread(open ? 0 : unread)
  }, [open, unread, onUnread])

  useEffect(() => {
    if (!open) return
    setUnread(0)
    if (conversationId) chatSeenAction().catch(() => undefined)
  }, [open, conversationId])

  useEffect(() => {
    if (open && (messages.length || tracking)) bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [open, messages.length, tracking])

  useEffect(() => {
    if (!typingAt) return
    const timer = setTimeout(() => setTypingAt(0), TYPING_SHOWN_MS)
    return () => clearTimeout(timer)
  }, [typingAt])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Helpers
  const send = async (
    input: { body?: string; photoToken?: string; website?: string },
    retryOf?: string,
  ) => {
    const clientId = retryOf ?? crypto.randomUUID()
    if (input.body) {
      const pending: ChatMessageView = {
        id: `pending-${clientId}`,
        sender: 'shopper',
        kind: 'text',
        body: input.body,
        payload: null,
        clientId,
        createdAt: new Date(),
        pending: 'sending',
      }
      setMessages((list) => [...list.filter((m) => m.clientId !== clientId), pending])
    }
    const result = await sendChatAction({
      ...input,
      clientId,
      url: window.location.pathname,
      ...(contact ? { name: contact.name, email: contact.email, phone: contact.phone } : {}),
    }).catch(() => ({ ok: false as const, error: 'failed' as const }))
    if (result.ok) {
      setNotice(null)
      setConversationId(result.conversationId)
      setMessages((list) => merge(list, result.message))
      onActive()
      return
    }
    setMessages((list) =>
      list.map((m) => (m.clientId === clientId && m.pending ? { ...m, pending: 'failed' } : m)),
    )
    if (result.error === 'sign_in') setNotice(copy.signInRequired)
    else if (result.error === 'blocked') setNotice(copy.blocked)
    else if (result.error === 'busy') setNotice(copy.tooMany)
  }

  // Event handlers
  const handleSend = (text: string, website: string) => send({ body: text, website })
  const handleRetry = (m: ChatMessageView) => {
    if (m.body && m.clientId) send({ body: m.body }, m.clientId)
  }
  const handleTyping = () => {
    const now = Date.now()
    if (!conversationId || now - lastTyping.current < TYPING_EVERY_MS) return
    lastTyping.current = now
    chatTypingAction(conversationId).catch(() => undefined)
  }
  const handlePhoto = async (file: File) => {
    setUploading(true)
    try {
      const form = new FormData()
      form.set('photo', file)
      const res = await fetch('/inbox/photo', { method: 'POST', body: form })
      const body = (await res.json()) as { ok: boolean; token?: string }
      if (body.ok && body.token) await send({ photoToken: body.token })
      else setNotice(copy.failed)
    } catch {
      setNotice(copy.failed)
    } finally {
      setUploading(false)
    }
  }

  // Early returns
  if (!state) return null

  // Render logic
  const visible = messages.filter((m) => m.kind !== 'system')
  const meta = threadMeta(visible)
  const lastSeenMine = staffSeen
    ? visible.filter((m) => m.sender === 'shopper' && !m.pending && m.id <= staffSeen).at(-1)?.id
    : undefined
  const needContact =
    contact === undefined &&
    !state.signedIn &&
    (state.contactRequired || (state.askContact && visible.length > 0))
  const blockedBySignIn = state.requireSignIn && !state.signedIn
  const signInHref = state.signedIn
    ? null
    : `/account/login?return_to=${encodeURIComponent(window.location.pathname)}`
  const side = widget.horizontal
  const frame =
    mode === 'expanded'
      ? 'inset-0'
      : mode === 'docked'
        ? `inset-y-0 w-full sm:w-[26rem] ${side === 'left' ? 'left-0 sm:origin-left' : 'right-0 sm:origin-right'}`
        : `inset-0 sm:inset-auto sm:bottom-(--chat-bottom) sm:h-[min(41rem,calc(100dvh-var(--chat-bottom)-1rem))] sm:w-[25rem] sm:rounded-(--chat-radius) ${
            side === 'left'
              ? 'sm:left-4 sm:origin-bottom-left'
              : side === 'center'
                ? 'sm:left-1/2 sm:-translate-x-1/2 sm:origin-bottom'
                : 'sm:right-4 sm:origin-bottom-right'
          }`
  const motion = open ? PANEL_OPEN : PANEL_CLOSED
  const style = {
    '--chat-accent': widget.background || 'var(--btn-bg, var(--color-ink, CanvasText))',
    '--chat-on-accent': widget.textColour || 'var(--btn-text, var(--color-bg, Canvas))',
    '--chat-radius': `${widget.borderRadius / 16}rem`,
    '--chat-bottom': `calc(${BOTTOM[widget.vertical]} + ${ABOVE_LAUNCHER} + env(safe-area-inset-bottom))`,
    fontFamily: chatFontFamily(widget.inheritFont),
  } as CSSProperties
  const hairline = 'border-[color-mix(in_srgb,currentColor_8%,transparent)]'

  return (
    <section
      role="dialog"
      aria-label={copy.title(storeName)}
      aria-hidden={!open}
      inert={!open}
      style={style}
      className={`${CHAT_GUARD} fixed z-50 flex flex-col overflow-hidden overscroll-contain bg-[var(--color-bg,Canvas)] text-[var(--color-ink,CanvasText)] shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_12px_32px_rgb(0_0_0/0.12),0_2px_6px_rgb(0_0_0/0.06)] ${PANEL_MOTION} ${frame} ${motion}`}
    >
      <ChatHeader
        storeName={storeName}
        logoUrl={logoUrl}
        available={state.available}
        mode={mode}
        onMode={setMode}
        onClose={onClose}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
        <div className="flex flex-col gap-3">
          <ChatIntro
            greeting={state.greeting}
            awayMessage={state.available ? null : state.awayMessage || copy.away}
            featured={visible.length === 0 && !tracking ? state.featured : []}
            onAsk={(text) => send({ body: text })}
            onTrack={() => setTracking(true)}
          />
          {visible.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              cards={cards}
              seen={m.id === lastSeenMine}
              storeName={storeName}
              first={meta.get(m.id)?.first ?? true}
              joined={meta.get(m.id)?.joined ?? false}
              onRetry={() => handleRetry(m)}
            />
          ))}
          {tracking ? (
            <ChatTrack
              signedIn={state.signedIn}
              onAsk={(t) => {
                send({ body: t })
              }}
            />
          ) : null}
          {typingAt ? (
            <p className="w-fit rounded-2xl rounded-bl-[0.25rem] bg-[color-mix(in_srgb,currentColor_6%,transparent)] px-3.5 py-2 text-[0.8125rem]! opacity-70">
              {copy.typing}
            </p>
          ) : null}
          {needContact ? (
            <ChatContactForm required={state.contactRequired} onDone={(c) => setContact(c)} />
          ) : null}
        </div>
        <div ref={bottomRef} />
      </div>
      <footer
        className={`border-t px-3 pt-3 pb-[max(0.625rem,env(safe-area-inset-bottom))] ${hairline}`}
      >
        <ChatComposer
          disabled={blockedBySignIn || (needContact && state.contactRequired)}
          notice={blockedBySignIn ? copy.signInRequired : (notice ?? undefined)}
          storeName={storeName}
          signInHref={signInHref}
          onSend={handleSend}
          onPhoto={handlePhoto}
          onTyping={handleTyping}
          uploading={uploading}
        />
      </footer>
    </section>
  )
}
