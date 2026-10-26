'use client'

import { useState } from 'react'
import { inboxChatContent as copy } from '@/data/inbox'
import { applyDiscountAction } from '@/lib/discount-actions'

type ChatDiscountCardProps = {
  code: string | null
  title: string
  active: boolean
}

/** A discount code shared in the chat, applied to the shopper's cart in one tap. */
export default function ChatDiscountCard({ code, title, active }: ChatDiscountCardProps) {
  // Hooks
  const [state, setState] = useState<'idle' | 'applying' | 'applied' | 'failed'>('idle')

  // Event handlers
  const handleApply = async () => {
    if (!code || state === 'applying') return
    setState('applying')
    const result = await applyDiscountAction(code).catch(() => ({ ok: false as const }))
    setState(result.ok ? 'applied' : 'failed')
  }

  // Render logic
  const status =
    state === 'applied'
      ? copy.card.applied
      : state === 'failed' || !active
        ? copy.card.inactive
        : null

  return (
    <div className="flex w-full max-w-[85%] items-center justify-between gap-3 rounded-[0.875rem] border border-dashed border-[color-mix(in_srgb,currentColor_22%,transparent)] px-3.5 py-2.5">
      <div className="flex min-w-0 flex-col">
        <span className="font-mono! text-[0.9375rem]! font-semibold! tracking-wide!">{code}</span>
        <span className="truncate text-[0.75rem]! opacity-60">{status ?? title}</span>
      </div>
      {active && state !== 'applied' ? (
        <button
          type="button"
          onClick={handleApply}
          disabled={state === 'applying'}
          className="shrink-0 touch-manipulation rounded-full bg-(--chat-accent)! px-3 py-1 text-[0.75rem]! font-medium! text-(--chat-on-accent)! transition-[scale,opacity] duration-(--duration-press) ease-out active:scale-(--motion-press-scale) disabled:opacity-60"
        >
          {copy.card.apply}
        </button>
      ) : null}
    </div>
  )
}
