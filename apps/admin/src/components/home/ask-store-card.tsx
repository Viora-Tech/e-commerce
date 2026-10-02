'use client'

import { ASK_MAX_QUESTION } from '@commerce/ai/client'
import { AiIcon, Send } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { useRef, useState } from 'react'
import KitButton from '@/components/kit/kit-button'
import DataCard from '@/components/layout/data-card'
import { aiContent } from '@/data/ai'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import AskStoreTurn, { type AskTurn } from './ask-store-turn'

type AskEvent = Awaited<ReturnType<typeof api.ai.ask>> extends AsyncIterable<infer E> ? E : never

/** Turns kept on screen; the last three go back to the model so follow-ups work. */
const MAX_TURNS = 4
const HISTORY_TURNS = 3

function applyEvent(turn: AskTurn, event: AskEvent): AskTurn {
  switch (event.type) {
    case 'text':
      return { ...turn, answer: turn.answer + event.delta }
    case 'source': {
      const others = turn.sources.filter((s) => s.id !== event.id)
      return { ...turn, sources: [...others, event] }
    }
    case 'error':
      return { ...turn, status: 'error', error: event.message }
    case 'done':
      return turn.status === 'streaming' ? { ...turn, status: 'done' } : turn
    default:
      return turn
  }
}

function historyOf(turns: AskTurn[]) {
  return turns
    .filter((t) => t.status === 'done' && t.answer)
    .slice(-HISTORY_TURNS)
    .flatMap((t) => [
      { role: 'user' as const, content: t.question },
      { role: 'assistant' as const, content: t.answer.slice(0, 4000) },
    ])
}

/**
 * Home's "Ask your store": a question box with suggested questions, answers streamed in from
 * the store's own numbers (read-only tools on the server), and the data behind each answer
 * one click away. Shown only when AI is on for this store and member.
 */
export default function AskStoreCard() {
  // Hooks
  const copy = useCopy(aiContent)
  const locale = useLocale()
  const [draft, setDraft] = useState('')
  const [turns, setTurns] = useState<AskTurn[]>([])
  const controller = useRef<AbortController | null>(null)

  // Helpers
  const update = (id: string, fn: (turn: AskTurn) => AskTurn) =>
    setTurns((all) => all.map((t) => (t.id === id ? fn(t) : t)))

  const ask = async (question: string) => {
    const q = question.trim().slice(0, ASK_MAX_QUESTION)
    if (!q || controller.current) return
    const abort = new AbortController()
    controller.current = abort
    const id = `${Date.now()}`
    const history = historyOf(turns)
    setDraft('')
    setTurns((all) => [
      ...all.slice(-(MAX_TURNS - 1)),
      { id, question: q, answer: '', sources: [], status: 'streaming', error: null },
    ])
    try {
      const events = await api.ai.ask(
        { question: q, history, language: locale },
        { signal: abort.signal },
      )
      for await (const event of events) update(id, (t) => applyEvent(t, event))
      update(id, (t) => (t.status === 'streaming' ? { ...t, status: 'done' } : t))
    } catch (err) {
      const stopped = abort.signal.aborted
      update(id, (t) => ({
        ...t,
        status: stopped ? 'stopped' : 'error',
        error: stopped ? null : err instanceof Error ? err.message : copy.ask.failed,
      }))
    } finally {
      controller.current = null
    }
  }

  // Event handlers
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    void ask(draft)
  }

  const handleStop = () => controller.current?.abort()

  const handleClear = () => {
    controller.current?.abort()
    setTurns([])
  }

  // Render logic
  const busy = turns.some((t) => t.status === 'streaming')

  return (
    <DataCard
      title={copy.ask.title}
      meta={copy.ask.subtitle}
      icon={<AiIcon className="size-5 text-primary" aria-hidden="true" />}
      action={
        turns.length > 0 ? (
          <KitButton variant="pill" onClick={handleClear}>
            {copy.ask.newQuestion}
          </KitButton>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {turns.length > 0 ? (
          <ul className="flex flex-col gap-5">
            {turns.map((turn) => (
              <AskStoreTurn key={turn.id} turn={turn} />
            ))}
          </ul>
        ) : null}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            size="kit"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={copy.ask.placeholder}
            aria-label={copy.ask.title}
            maxLength={ASK_MAX_QUESTION}
            className="min-w-0 flex-1"
            disabled={busy}
          />
          {busy ? (
            <KitButton variant="secondary" onClick={handleStop} className="min-w-0">
              {copy.ask.stop}
            </KitButton>
          ) : (
            <KitButton type="submit" variant="primary" disabled={!draft.trim()} className="min-w-0">
              <Send className="size-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">{copy.ask.send}</span>
            </KitButton>
          )}
        </form>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
          {copy.ask.suggestions.map((s) => (
            <KitButton
              key={s}
              variant="chip"
              onClick={() => void ask(s)}
              disabled={busy}
              className="shrink-0"
            >
              {s}
            </KitButton>
          ))}
        </div>
        <p className="text-caption text-muted-foreground">{copy.disclaimer}</p>
      </div>
    </DataCard>
  )
}
