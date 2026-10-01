'use client'

import { AiIcon, CircleAlert } from '@commerce/ui/icons'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { aiContent } from '@/data/ai'
import { useCopy } from '@/hooks/use-copy'
import { type AnswerSpan, parseAnswer } from '@/lib/ai-answer'

export type AskSource = {
  id: string
  tool: string
  status: 'running' | 'done' | 'failed'
  facts: { label: string; value: string }[]
}

export type AskTurn = {
  id: string
  question: string
  answer: string
  sources: AskSource[]
  status: 'streaming' | 'done' | 'error' | 'stopped'
  error: string | null
}

type AskStoreTurnProps = {
  turn: AskTurn
}

/** One question and its streamed answer, with the store data the answer was built from. */
export default function AskStoreTurn({ turn }: AskStoreTurnProps) {
  // Hooks
  const copy = useCopy(aiContent)
  const [showSources, setShowSources] = useState(false)

  // Render logic
  const blocks = parseAnswer(turn.answer)
  const running = turn.sources.find((s) => s.status === 'running')
  const done = turn.sources.filter((s) => s.status === 'done' && s.facts.length > 0)
  const waiting = turn.status === 'streaming' && !turn.answer

  return (
    <li className="flex flex-col gap-3">
      <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-3.5 py-2 text-body text-ink-strong">
        {turn.question}
      </p>
      <div className="flex gap-3">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <AiIcon className="size-4 text-primary" aria-hidden="true" />
        </span>
        <div
          className="flex min-w-0 flex-1 flex-col gap-2 text-body text-ink-strong"
          aria-live="polite"
        >
          {waiting ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Spinner />
              {running
                ? copy.ask.checking(copy.ask.tools[running.tool] ?? running.tool)
                : copy.ask.thinking}
            </p>
          ) : null}
          {blocks.map((block, i) =>
            block.type === 'p' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: blocks are re-parsed from streamed text
              <p key={i}>
                <Spans spans={block.spans} />
              </p>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: blocks are re-parsed from streamed text
              <ul key={i} className="list-disc space-y-1 pl-5">
                {block.items.map((item, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: list items are re-parsed from streamed text
                  <li key={j}>
                    <Spans spans={item} />
                  </li>
                ))}
              </ul>
            ),
          )}
          {turn.status === 'error' ? (
            <p className="flex items-center gap-2 text-destructive">
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              {turn.error ?? copy.ask.failed}
            </p>
          ) : null}
          {turn.status === 'stopped' ? (
            <p className="text-muted-foreground">{copy.ask.stopped}</p>
          ) : null}
          {done.length > 0 && turn.status !== 'streaming' ? (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowSources((v) => !v)}
                className="w-fit text-caption font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                aria-expanded={showSources}
              >
                {showSources ? copy.ask.sourcesHide : copy.ask.sourcesToggle(done.length)}
              </button>
              {showSources ? (
                <div className="flex max-w-xl flex-col gap-3 rounded-xl border border-border bg-background p-3">
                  <p className="text-caption font-medium text-muted-foreground uppercase">
                    {copy.ask.sourcesTitle}
                  </p>
                  {done.map((source) => (
                    <dl
                      key={source.id}
                      className="grid grid-cols-1 gap-x-4 gap-y-1 text-caption sm:grid-cols-[minmax(0,1fr)_auto]"
                    >
                      {source.facts.map((fact) => (
                        <div key={fact.label} className="contents">
                          <dt className="text-muted-foreground">{fact.label}</dt>
                          <dd className="font-medium text-ink-strong tabular-nums sm:text-right">
                            {fact.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  )
}

function Spans({ spans }: { spans: AnswerSpan[] }) {
  return spans.map((s, i) =>
    s.bold ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: spans have no identity beyond their order
      <strong key={i} className="font-semibold text-ink-strong">
        {s.text}
      </strong>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: spans have no identity beyond their order
      <span key={i}>{s.text}</span>
    ),
  )
}
