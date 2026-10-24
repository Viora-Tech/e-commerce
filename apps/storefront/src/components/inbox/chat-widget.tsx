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
import ChatComposer from './chat-composer'
import ChatContactForm from './chat-contact-form'
import ChatIcon from './chat-icon'
import ChatIntro from './chat-intro'
import ChatMessage, { type ChatMessageView } from './chat-message'

type ChatWidgetProps = {
  open: boolean
  widget: InboxWidget
  storeName: string
  onClose: () => void
  /** The shopper sent a message: the chat should load on idle next time. */
  onActive: () => void
  /** Staff replies the shopper has not seen while the chat is closed. */
  onUnread: (n: number) => void
}

type Mode = 'float' | 'expanded' | 'docked'
type Contact = { name: string; email: string; phone: string }

const TYPING_EVERY_MS = 3000
const TYPING_SHOWN_MS = 5000

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

/** Adds a message once by id (or replaces the optimistic copy with the same client id). */
function merge(list: ChatMessageView[], m: ChatMessageView): ChatMessageView[] {
  if (list.some((x) => x.id === m.id)) return list
  const rest = m.clientId ? list.filter((x) => !(x.pending && x.clientId === m.clientId)) : list
  return [...rest, m].sort(byId)
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
 * The chat card (Shopify Inbox's): a large rounded glassy panel with full screen, dock to the
 * side and minimise; the intro with featured products and suggested questions; the thread
 * with product and code cards, photos and cart lines; and the "Ask anything…" field.
 */
export default function ChatWidget({
  open,
  widget,
  storeName,
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
  const [mode, setMode] = useState<Mode>('float')
  const [notice, setNotice] = useState<string | null>(null)
  const [contact, setContact] = useState<Contact | null | undefined>(undefined)
  const [typingAt, setTypingAt] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [unread, setUnread] = useState(0)
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
    if (open && messages.length) bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [open, messages.length])

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
  if (!open || !state) return null

  // Render logic
  const visible = messages.filter((m) => m.kind !== 'system')
  const lastSeenMine = staffSeen
    ? visible.filter((m) => m.sender === 'shopper' && !m.pending && m.id <= staffSeen).at(-1)?.id
    : undefined
  const needContact =
    contact === undefined &&
    !state.signedIn &&
    (state.contactRequired || (state.askContact && visible.length > 0))
  const blockedBySignIn = state.requireSignIn && !state.signedIn
  const radius = `${widget.borderRadius / 16}rem`
  const frame =
    mode === 'expanded'
      ? 'inset-0 rounded-none'
      : mode === 'docked'
        ? 'top-0 right-0 bottom-0 w-full sm:w-[26rem] rounded-none'
        : 'right-2 bottom-2 left-2 h-[min(42rem,calc(100dvh-1rem))] sm:left-auto sm:right-4 sm:bottom-4 sm:w-[31rem]'
  const style = {
    ...(mode === 'float' ? { borderRadius: radius } : {}),
    ...(widget.background ? { backgroundColor: widget.background } : {}),
    ...(widget.textColour ? { color: widget.textColour } : {}),
    ...(widget.inheritFont ? { fontFamily: 'var(--font-body, inherit)' } : {}),
  } as CSSProperties
  const iconButton =
    'touch-manipulation rounded-full p-1.5 opacity-70 transition-[opacity,background-color] hover:bg-[color-mix(in_srgb,currentColor_8%,transparent)] hover:opacity-100'

  return (
    <section
      role="dialog"
      aria-label={copy.title(storeName)}
      style={style}
      className={`fixed z-50 flex flex-col overflow-hidden overscroll-contain border border-[color-mix(in_srgb,currentColor_10%,transparent)] bg-[color-mix(in_srgb,var(--color-bg,Canvas)_88%,transparent)] text-[var(--color-ink,CanvasText)] shadow-2xl backdrop-blur-xl ${frame}`}
    >
      <header className="flex items-center justify-between gap-2 px-4 pt-3 pb-2">
        {state.signedIn ? (
          <span className="truncate text-[0.875rem] font-medium">{storeName}</span>
        ) : (
          <a
            href={`/account/login?return_to=${encodeURIComponent(window.location.pathname)}`}
            className="rounded-full border border-[color-mix(in_srgb,currentColor_18%,transparent)] px-3 py-1 text-[0.8125rem]"
          >
            {copy.signIn}
          </a>
        )}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className={`${iconButton} hidden sm:block`}
            aria-label={mode === 'expanded' ? copy.restore : copy.expand}
            onClick={() => setMode(mode === 'expanded' ? 'float' : 'expanded')}
          >
            <ChatIcon kind={mode === 'expanded' ? 'shrink' : 'expand'} className="size-4" />
          </button>
          <button
            type="button"
            className={`${iconButton} hidden sm:block`}
            aria-label={mode === 'docked' ? copy.undock : copy.dock}
            onClick={() => setMode(mode === 'docked' ? 'float' : 'docked')}
          >
            <ChatIcon kind="dock" className="size-4" />
          </button>
          <button type="button" className={iconButton} aria-label={copy.close} onClick={onClose}>
            <ChatIcon kind="minimise" className="size-4" />
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-2">
        <div className="flex flex-col gap-3">
          <ChatIntro
            greeting={state.greeting}
            awayMessage={state.awayMessage}
            available={state.available}
            storeName={storeName}
            featured={visible.length === 0 ? state.featured : []}
            onAsk={(text) => send({ body: text })}
          />
          {visible.map((m) => (
            <ChatMessage
              key={m.id}
              message={m}
              cards={cards}
              seen={m.id === lastSeenMine}
              onRetry={() => handleRetry(m)}
            />
          ))}
          {typingAt ? <p className="text-[0.75rem] opacity-60">{copy.typing}</p> : null}
          {needContact ? (
            <ChatContactForm required={state.contactRequired} onDone={(c) => setContact(c)} />
          ) : null}
        </div>
        <div ref={bottomRef} />
      </div>
      <footer className="px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <ChatComposer
          disabled={blockedBySignIn || (needContact && state.contactRequired)}
          notice={blockedBySignIn ? copy.signInRequired : (notice ?? undefined)}
          onSend={handleSend}
          onPhoto={handlePhoto}
          onTyping={handleTyping}
          uploading={uploading}
        />
      </footer>
    </section>
  )
}
