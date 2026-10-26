'use client'

import { useEffect, useState } from 'react'
import { chatTrackContent } from '@/data/chat-track'
import { inboxChatContent } from '@/data/inbox'
import type { ChatOrderView } from '@/lib/chat-track'
import { chatRecentOrdersAction } from '@/lib/chat-track-actions'
import ChatIcon from './chat-icon'
import ChatOrderCard from './chat-order-card'
import ChatTrackForm from './chat-track-form'
import ChatTrackRecent from './chat-track-recent'

type ChatTrackProps = {
  signedIn: boolean
  /** Sends a chat message as the shopper (e.g. "Talk to a person about #1042"). */
  onAsk: (text: string) => void
}

const copy = chatTrackContent

const bubbleMine =
  'max-w-[85%] self-end rounded-2xl rounded-br-[0.25rem] bg-(--chat-accent)! px-3.5 py-2 text-[0.9375rem]! leading-snug! text-(--chat-on-accent)!'

const bubbleTheirs =
  'max-w-[85%] self-start rounded-2xl rounded-bl-[0.25rem] bg-[color-mix(in_srgb,currentColor_6%,transparent)] px-3.5 py-2 text-[0.9375rem]! leading-snug!'

const textButton =
  'min-h-11 touch-manipulation self-start px-1 text-[0.8125rem]! font-medium! underline underline-offset-2'

/**
 * "Track my order" inside the chat thread: the shopper's ask, the store's reply, then a guest's
 * lookup form or a signed-in shopper's recent orders, and the order's card once one is picked.
 */
export default function ChatTrack({ signedIn, onAsk }: ChatTrackProps) {
  // Hooks
  /** Undefined while loading; null when the session turned out to be gone. */
  const [recent, setRecent] = useState<ChatOrderView[] | null | undefined>(
    signedIn ? undefined : null,
  )
  const [picked, setPicked] = useState<ChatOrderView | null>(null)
  const [lookup, setLookup] = useState(false)

  useEffect(() => {
    if (!signedIn) return
    let live = true
    chatRecentOrdersAction()
      .then((orders) => {
        if (live) setRecent(orders)
      })
      .catch(() => {
        if (live) setRecent(null)
      })
    return () => {
      live = false
    }
  }, [signedIn])

  // Event handlers
  const handleBack = () => {
    setPicked(null)
    setLookup(false)
  }

  // Render logic
  const hasRecent = !!recent && recent.length > 0
  // Signed in with orders (or still loading them): the list, not the form.
  const listing = signedIn && !lookup && recent !== null && recent?.length !== 0
  const showRecent = hasRecent && !lookup && !picked
  const showForm = !picked && recent !== undefined && (!hasRecent || lookup)

  return (
    <div className="flex flex-col gap-2.5">
      <p className={bubbleMine}>{copy.ask}</p>
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-1 text-[0.6875rem]! font-medium! opacity-60">
          <ChatIcon kind="sparkle" className="size-3" />
          {inboxChatContent.assistant}
        </span>
        <p className={bubbleTheirs}>{listing ? copy.introSignedIn : copy.intro}</p>
      </div>
      <div aria-live="polite" className="flex flex-col gap-2.5">
        {recent === undefined ? (
          <p className="text-[0.8125rem]! opacity-60">{copy.recent.loading}</p>
        ) : null}
        {recent && recent.length === 0 && !picked ? (
          <p className={bubbleTheirs}>{copy.recent.none}</p>
        ) : null}
        {showRecent && recent ? (
          <>
            <ChatTrackRecent orders={recent} onPick={setPicked} />
            <button type="button" className={textButton} onClick={() => setLookup(true)}>
              {copy.recent.another}
            </button>
          </>
        ) : null}
        {showForm ? (
          <ChatTrackForm signedIn={signedIn && recent !== null} onFound={setPicked} />
        ) : null}
        {picked ? (
          <>
            <ChatOrderCard order={picked} onAsk={onAsk} />
            <button type="button" className={textButton} onClick={handleBack}>
              {hasRecent ? copy.card.back : copy.recent.another}
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
