'use client'

import { AiIcon } from '@commerce/ui/icons'
import { inboxConversationsContent } from '@/data/inbox-conversations'
import { useCopy } from '@/hooks/use-copy'

type HandoffBannerProps = {
  /** The AI agent's note for the team; null when it left none. */
  summary: string | null
}

/** Above the thread while the AI agent's hand-off waits for a person: why, and that replying takes over. */
export default function HandoffBanner({ summary }: HandoffBannerProps) {
  // Hooks
  const copy = useCopy(inboxConversationsContent)

  // Render logic
  const h = copy.thread.handoff

  return (
    <div className="flex items-start gap-2.5 border-b border-hairline bg-muted/50 px-4 py-3">
      <AiIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="text-body-strong">{h.title}</p>
        {summary ? <p className="text-body text-muted-foreground">{summary}</p> : null}
        <p className="text-caption text-muted-foreground">{h.hint}</p>
      </div>
    </div>
  )
}
