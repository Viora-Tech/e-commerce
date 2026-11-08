'use client'

import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy } from '@/hooks/use-copy'

type QuickReplyChipsProps = {
  replies: { id: string; title: string; body: string }[]
  onPick: (body: string) => void
}

/** How many saved replies sit above the box; the rest stay one `/` away. */
const SHOWN = 6

/**
 * The team's saved replies as one row of chips above the reply box: one tap puts the reply in
 * the box to edit before sending. Scrolls sideways on a narrow pane instead of wrapping.
 */
export default function QuickReplyChips({ replies, onPick }: QuickReplyChipsProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)

  // Early returns
  if (replies.length === 0) return null

  // Render logic
  return (
    <nav
      aria-label={copy.composer.quickReplies}
      className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 pt-2.5"
    >
      {replies.slice(0, SHOWN).map((r) => (
        <button
          key={r.id}
          type="button"
          title={r.body}
          onClick={() => onPick(r.body)}
          className="motion-press shrink-0 rounded-full border border-hairline bg-background px-3 py-1 text-caption text-ink-strong transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {r.title}
        </button>
      ))}
    </nav>
  )
}
