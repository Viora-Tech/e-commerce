'use client'

import { CircleAlert } from '@commerce/ui/icons'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import type { ReactNode } from 'react'
import { assistantContent } from '@/data/assistant'
import type { ActionView, AssistantTurn } from '@/hooks/use-assistant'
import { useCopy } from '@/hooks/use-copy'
import ActionCard from './action-card'
import AnswerTableCard from './answer-table-card'
import AssistantAnswer from './assistant-answer'
import AssistantQuery from './assistant-query'
import AssistantSources from './assistant-sources'

type AssistantTurnProps = {
  turn: AssistantTurn
  onAction: (view: ActionView) => void
  /** Cards a host adds after the change cards (the theme editor's page edits). */
  children?: ReactNode
}

/**
 * One message and its answer: what was checked, the streamed words, the tables the tools read
 * (#192), any change cards, then "Data used" and "Show query".
 */
export default function AssistantTurnView({ turn, onAction, children }: AssistantTurnProps) {
  // Hooks
  const copy = useCopy(assistantContent)

  // Render logic
  const running = turn.sources.find((s) => s.status === 'running')
  const waiting =
    turn.status === 'streaming' && !turn.answer && !turn.actions.length && !turn.themeEdits?.length
  const status = running
    ? copy.panel.checking(copy.tools[running.tool] ?? running.tool)
    : copy.panel.thinking
  const tables = turn.sources.filter((s) => s.status === 'done' && s.table)

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
        {tables.map((source) =>
          source.table ? (
            <AnswerTableCard
              key={source.id}
              table={source.table}
              tool={source.tool}
              question={turn.message}
            />
          ) : null,
        )}
        {turn.actions.map((action) => (
          <ActionCard key={action.id} action={action} onChange={onAction} />
        ))}
        {children}
        {turn.status === 'error' ? (
          <p className="flex items-center gap-2 text-body text-destructive">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {turn.error ?? copy.panel.failed}
          </p>
        ) : null}
        {turn.status === 'stopped' ? (
          <p className="text-caption text-muted-foreground">{copy.panel.stopped}</p>
        ) : null}
        {turn.status !== 'streaming' ? (
          <div className="flex flex-col gap-2">
            <AssistantSources sources={turn.sources} />
            <AssistantQuery sources={turn.sources} />
          </div>
        ) : null}
      </div>
    </li>
  )
}
