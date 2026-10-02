'use client'

import { CircleAlert } from '@commerce/ui/icons'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { assistantContent } from '@/data/assistant'
import type { ActionView, AssistantTurn } from '@/hooks/use-assistant'
import { useCopy } from '@/hooks/use-copy'
import ActionCard from './action-card'
import AssistantAnswer from './assistant-answer'
import AssistantSources from './assistant-sources'

type AssistantTurnProps = {
  turn: AssistantTurn
  onAction: (view: ActionView) => void
}

/** One message and its answer: what was checked, the streamed words, and any change cards. */
export default function AssistantTurnView({ turn, onAction }: AssistantTurnProps) {
  // Hooks
  const copy = useCopy(assistantContent)

  // Render logic
  const running = turn.sources.find((s) => s.status === 'running')
  const waiting = turn.status === 'streaming' && !turn.answer && !turn.actions.length
  const status = running
    ? copy.panel.checking(copy.tools[running.tool] ?? running.tool)
    : copy.panel.thinking

  return (
    <li className="flex flex-col gap-3">
      <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-3.5 py-2 text-body whitespace-pre-wrap text-ink-strong">
        {turn.message}
      </p>
      <div className="flex min-w-0 flex-col gap-3" aria-live="polite">
        {waiting ? (
          <p className="flex items-center gap-2 text-body text-muted-foreground">
            <Spinner />
            {status}
          </p>
        ) : null}
        {turn.answer ? <AssistantAnswer text={turn.answer} /> : null}
        {turn.actions.map((action) => (
          <ActionCard key={action.id} action={action} onChange={onAction} />
        ))}
        {turn.status === 'error' ? (
          <p className="flex items-center gap-2 text-body text-destructive">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {turn.error ?? copy.panel.failed}
          </p>
        ) : null}
        {turn.status === 'stopped' ? (
          <p className="text-caption text-muted-foreground">{copy.panel.stopped}</p>
        ) : null}
        {turn.status !== 'streaming' ? <AssistantSources sources={turn.sources} /> : null}
      </div>
    </li>
  )
}
