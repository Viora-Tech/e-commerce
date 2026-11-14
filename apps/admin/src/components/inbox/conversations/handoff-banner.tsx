'use client'

import { AiIcon } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
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
    // The neutral banner as a strip across the top of the thread.
    <Alert tone="neutral" role="status" className="rounded-none border-x-0 border-t-0">
      <AiIcon aria-hidden="true" />
      <AlertTitle className="text-body-strong">{h.title}</AlertTitle>
      <AlertDescription>
        {summary ? <p className="text-body">{summary}</p> : null}
        <p className="text-caption">{h.hint}</p>
      </AlertDescription>
    </Alert>
  )
}
