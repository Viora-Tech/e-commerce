'use client'

import type { InboxConnectionEvent } from '@commerce/core/inbox'
import { permissions } from '@commerce/core/permissions'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { inboxKnowledgeContent } from '@/data/inbox-knowledge'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { conversationName, withMessage } from '@/lib/inbox-view'
import { routes } from '@/lib/routes'
import AiActiveBanner from './ai-active-banner'
import Composer, { type ComposerSend } from './composer'
import CustomerPanel from './customer-panel'
import HandoffBanner from './handoff-banner'
import MessageItem, { type ThreadData, type ThreadMessage } from './message-item'
import SuggestedReplies from './suggested-replies'
import ThreadHeader from './thread-header'
import ThreadSummary from './thread-summary'

type ThreadPaneProps = {
  conversationId: string
  /** The latest live event, numbered so the same event twice still counts. */
  live: { seq: number; event: InboxConnectionEvent } | null
  assignees: { userId: string; name: string | null; email: string }[]
  quickReplies: { id: string; shortcut: string; title: string; body: string }[]
  /** AI is set up and the assistant is on: show suggested replies and the chat summary. */
  aiHelp: boolean
  nameOfMember: (userId: string) => string
  /** A close or reopen made anywhere on the page (row circle, header, Undo), applied here at once. */
  statusChange: { seq: number; id: string; status: 'open' | 'closed' } | null
  onBack: () => void
  /** The list should refresh (status or assignment changed here). */
  onChanged: () => void
  /** Close or reopen this conversation (optimistic, with Undo); the page owns it. */
  onSetStatus: (next: 'open' | 'closed', prev: 'open' | 'closed') => void
}

/** How long a "Typing…" from the shopper stays up without another one. */
const TYPING_MS = 5000
/** At most one typing signal to the shopper this often. */
const TYPING_EVERY_MS = 3000
/** Threads this long (messages anyone can see) open with an AI summary. */
const SUMMARY_FROM = 6

/**
 * The open conversation: header, messages (older pages on demand), the composer, and the
 * customer panel (inline on wide screens, a dialog below). Live messages join through `live`.
 */
export default function ThreadPane({
  conversationId,
  live,
  assignees,
  quickReplies,
  aiHelp,
  nameOfMember,
  statusChange,
  onBack,
  onChanged,
  onSetStatus,
}: ThreadPaneProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)
  const knowledgeCopy = useCopy(inboxKnowledgeContent)
  const { hasPermission } = usePermissions()
  const [thread, setThread] = useState<ThreadData | null>(null)
  const [typingAt, setTypingAt] = useState(0)
  const [cartKey, setCartKey] = useState(0)
  const [blocking, setBlocking] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [seed, setSeed] = useState<{ seq: number; text: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const lastTyping = useRef(0)

  useEffect(() => {
    let alive = true
    setThread(null)
    api.inbox.get({ id: conversationId }).then((t) => {
      if (!alive) return
      setThread(t)
      api.inbox.markSeen({ id: conversationId }).catch(() => undefined)
    })
    return () => {
      alive = false
    }
  }, [conversationId])

  useEffect(() => {
    const event = live?.event
    if (!event || event.conversationId !== conversationId) return
    if (event.type === 'message') {
      const message = event.message as ThreadMessage
      setThread((t) => (t ? { ...t, messages: withMessage(t.messages, message) } : t))
      if (message.kind === 'cart_event') setCartKey((k) => k + 1)
      if (message.kind === 'product' || message.kind === 'discount') {
        api.inbox
          .cards({ messages: [{ kind: message.kind, payload: message.payload }] })
          .then((cards) =>
            setThread((t) =>
              t
                ? {
                    ...t,
                    cards: {
                      products: { ...t.cards.products, ...cards.products },
                      discounts: { ...t.cards.discounts, ...cards.discounts },
                    },
                  }
                : t,
            ),
          )
          .catch(() => undefined)
      }
      if (message.sender === 'shopper') {
        setTypingAt(0)
        // A shopper's message reopens a closed chat (the server already did).
        setThread((t) =>
          t?.conversation.status === 'closed'
            ? { ...t, conversation: { ...t.conversation, status: 'open' } }
            : t,
        )
        api.inbox.markSeen({ id: conversationId }).catch(() => undefined)
      }
    } else if (event.type === 'typing' && event.sender === 'shopper') {
      setTypingAt(Date.now())
    } else if (event.type === 'seen' && event.by === 'shopper') {
      const messageId = typeof event.messageId === 'string' ? event.messageId : null
      setThread((t) =>
        t ? { ...t, conversation: { ...t.conversation, shopperSeenMessageId: messageId } } : t,
      )
    }
  }, [live, conversationId])

  useEffect(() => {
    if (!statusChange || statusChange.id !== conversationId) return
    const status = statusChange.status
    setThread((t) =>
      t && t.conversation.status !== 'blocked'
        ? { ...t, conversation: { ...t.conversation, status } }
        : t,
    )
  }, [statusChange, conversationId])

  useEffect(() => {
    if (thread?.messages.length) bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [thread?.messages.length])

  useEffect(() => {
    if (!typingAt) return
    const timer = setTimeout(() => setTypingAt(0), TYPING_MS)
    return () => clearTimeout(timer)
  }, [typingAt])

  // Helpers
  const fail = (err: unknown) =>
    toast.error(err instanceof Error && err.message ? err.message : copy.failed)
  const reload = async () => {
    const t = await api.inbox.get({ id: conversationId })
    setThread(t)
    onChanged()
  }

  // Event handlers
  const handleSend = async (m: ComposerSend) => {
    const clientId = crypto.randomUUID()
    const sent = await api.inbox.send({ conversationId, clientId, ...m })
    setThread((t) =>
      t
        ? {
            ...t,
            messages: withMessage(t.messages, sent.message as ThreadMessage),
            conversation: {
              ...t.conversation,
              status: sent.conversation.status,
              // A reply (not a note) takes the chat over from the AI.
              needsHuman: m.kind === 'note' ? t.conversation.needsHuman : false,
              aiActive: false,
            },
          }
        : t,
    )
    if (m.kind === 'product' || m.kind === 'discount') await reload()
    else onChanged()
  }
  const handleTyping = () => {
    const now = Date.now()
    if (now - lastTyping.current < TYPING_EVERY_MS) return
    lastTyping.current = now
    api.inbox.typing({ id: conversationId }).catch(() => undefined)
  }
  const handleAssign = async (assigneeUserId: string | null) => {
    try {
      await api.inbox.assign({ id: conversationId, assigneeUserId })
      await reload()
    } catch (err) {
      fail(err)
    }
  }
  const handleStatus = async (status: 'open' | 'closed' | 'blocked') => {
    try {
      await api.inbox.setStatus({ id: conversationId, status })
      await reload()
    } catch (err) {
      fail(err)
      throw err
    }
  }
  const handleTakeOver = async () => {
    try {
      await api.inbox.takeOver({ id: conversationId })
      setThread((t) => (t ? { ...t, conversation: { ...t.conversation, aiActive: false } } : t))
      toast.success(knowledgeCopy.takeOver.done)
      onChanged()
    } catch (err) {
      fail(err)
    }
  }
  const handleOlder = async () => {
    const first = thread?.messages[0]
    if (!first) return
    const page = await api.inbox.get({ id: conversationId, beforeId: first.id })
    setThread((t) =>
      t
        ? {
            ...t,
            messages: [...page.messages, ...t.messages],
            hasMore: page.hasMore,
            cards: {
              products: { ...t.cards.products, ...page.cards.products },
              discounts: { ...t.cards.discounts, ...page.cards.discounts },
            },
          }
        : t,
    )
  }
  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(
      `${window.location.origin}${routes.salesChannels.inboxConversation(conversationId)}`,
    )
    toast.success(copy.thread.copied)
  }

  // Early returns
  if (!thread) {
    return (
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  // Render logic
  const c = thread.conversation
  const name = conversationName(c, copy)
  const canReply = hasPermission(permissions.INBOX_REPLY)
  const lastSeenStaff = c.shopperSeenMessageId
    ? [...thread.messages]
        .filter(
          (m) =>
            m.sender === 'staff' && m.kind !== 'note' && m.id <= (c.shopperSeenMessageId ?? ''),
        )
        .at(-1)?.id
    : undefined
  const visible = thread.messages.filter((m) => m.sender !== 'system' && m.kind !== 'note')
  const newest = visible.at(-1)
  const awaiting = newest?.sender === 'shopper' ? newest.id : null
  const showSuggestions = aiHelp && canReply && c.status !== 'blocked' && awaiting !== null
  const showSummary = aiHelp && visible.length >= SUMMARY_FROM && newest !== undefined
  const panel = (
    <CustomerPanel
      conversationId={conversationId}
      contact={{ email: c.email, phone: c.contactPhone }}
      refreshKey={cartKey}
      canReadOrders={hasPermission(permissions.ORDERS_READ)}
    />
  )

  return (
    <div className="flex min-h-0 min-w-0 flex-1">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ThreadHeader
          name={name}
          status={c.status}
          spam={c.blockedReason === 'spam'}
          assigneeUserId={c.assigneeUserId}
          assignees={assignees}
          canReply={canReply}
          nameOfMember={nameOfMember}
          onBack={onBack}
          onAssign={handleAssign}
          onStatus={(s) =>
            c.status === 'blocked'
              ? handleStatus(s).catch(() => undefined)
              : onSetStatus(s, c.status)
          }
          onBlock={() => setBlocking(true)}
          onCopyLink={handleCopyLink}
          onCustomer={() => setPanelOpen(true)}
        />
        {c.needsHuman ? <HandoffBanner summary={c.handoffSummary} /> : null}
        {c.aiActive ? <AiActiveBanner canTakeOver={canReply} onTakeOver={handleTakeOver} /> : null}
        {showSummary ? (
          <ThreadSummary conversationId={conversationId} latestId={newest.id} />
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {thread.hasMore ? (
            <div className="mb-3 flex justify-center">
              <Button variant="ghost" size="sm" onClick={handleOlder}>
                {copy.thread.olderMessages}
              </Button>
            </div>
          ) : null}
          <div className="flex flex-col gap-3">
            {thread.messages.map((m) => (
              <MessageItem
                key={m.id}
                message={m}
                cards={thread.cards}
                seen={m.id === lastSeenStaff}
                nameOfMember={nameOfMember}
              />
            ))}
            {typingAt ? (
              <p className="text-caption text-muted-foreground" aria-live="polite">
                {copy.thread.typing}
              </p>
            ) : null}
          </div>
          <div ref={bottomRef} />
        </div>
        {showSuggestions ? (
          <SuggestedReplies
            conversationId={conversationId}
            messageId={awaiting}
            onPick={(text) => setSeed((s) => ({ seq: (s?.seq ?? 0) + 1, text }))}
          />
        ) : null}
        {canReply ? (
          <Composer
            disabled={c.status === 'blocked'}
            disabledReason={c.status === 'blocked' ? copy.composer.blocked : undefined}
            quickReplies={quickReplies}
            canShareProducts={hasPermission(permissions.PRODUCTS_READ)}
            canShareDiscounts={hasPermission(permissions.DISCOUNTS_READ)}
            onSend={handleSend}
            onTyping={handleTyping}
            seed={seed}
          />
        ) : null}
      </div>
      <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-hairline xl:block">
        {panel}
      </aside>
      <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
        <DialogContent className="sm:max-w-md xl:hidden">
          <DialogHeader>
            <DialogTitle>{copy.panel.title}</DialogTitle>
          </DialogHeader>
          {panelOpen ? panel : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={blocking}
        onOpenChange={setBlocking}
        title={copy.thread.confirmBlock.title}
        body={copy.thread.confirmBlock.body}
        confirmLabel={copy.thread.confirmBlock.confirm}
        tone="destructive"
        onConfirm={async () => {
          await handleStatus('blocked')
          setBlocking(false)
        }}
      />
    </div>
  )
}
