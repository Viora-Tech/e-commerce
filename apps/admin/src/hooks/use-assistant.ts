'use client'

import { ASSISTANT_MAX_MESSAGE, type AssistantPageContext } from '@commerce/ai/client'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api-client'

export type AssistantEvent =
  Awaited<ReturnType<typeof api.ai.assistant>> extends AsyncIterable<infer E> ? E : never
export type ActionView = Extract<AssistantEvent, { type: 'proposal' }>['action']
export type AssistantSource = Extract<AssistantEvent, { type: 'source' }>

export type AssistantTurn = {
  id: string
  message: string
  answer: string
  sources: AssistantSource[]
  actions: ActionView[]
  status: 'streaming' | 'done' | 'error' | 'stopped'
  error: string | null
}

/** Turns kept per tab; the last few go back to the model so follow-ups work. */
const MAX_TURNS = 20
const HISTORY_TURNS = 4

function storageKey(storeId: string | null): string {
  return `admin-assistant:v1:${storeId ?? 'none'}`
}

function load(storeId: string | null): AssistantTurn[] {
  try {
    const raw = window.sessionStorage.getItem(storageKey(storeId))
    const turns = raw ? (JSON.parse(raw) as AssistantTurn[]) : []
    // A reload mid-answer leaves nothing streaming.
    return turns.map((t) => (t.status === 'streaming' ? { ...t, status: 'stopped' } : t))
  } catch {
    return []
  }
}

function save(storeId: string | null, turns: AssistantTurn[]) {
  try {
    window.sessionStorage.setItem(storageKey(storeId), JSON.stringify(turns.slice(-MAX_TURNS)))
  } catch {
    // Private mode or full storage: the conversation just is not kept.
  }
}

function applyEvent(turn: AssistantTurn, event: AssistantEvent): AssistantTurn {
  switch (event.type) {
    case 'text':
      return { ...turn, answer: turn.answer + event.delta }
    case 'source':
      return { ...turn, sources: [...turn.sources.filter((s) => s.id !== event.id), event] }
    case 'proposal':
      return { ...turn, actions: [...turn.actions, event.action] }
    case 'error':
      return { ...turn, status: 'error', error: event.message }
    case 'done':
      return turn.status === 'streaming' ? { ...turn, status: 'done' } : turn
    default:
      return turn
  }
}

/** What the model hears of earlier turns: the words, plus one line per change and what became of it. */
function historyOf(turns: AssistantTurn[]) {
  return turns
    .filter((t) => t.status === 'done' && (t.answer || t.actions.length))
    .slice(-HISTORY_TURNS)
    .flatMap((t) => {
      const changes = t.actions.map((a) => `[Change: ${a.summary} (${a.status})]`).join('\n')
      const answer = [t.answer, changes].filter(Boolean).join('\n\n').slice(0, 4000)
      return [
        { role: 'user' as const, content: t.message.slice(0, 4000) },
        { role: 'assistant' as const, content: answer },
      ]
    })
}

/**
 * The assistant's conversation for this tab and store: kept in sessionStorage, streamed in
 * from `ai.assistant`, with the change cards updated in place as the merchant acts on them.
 */
export function useAssistant(storeId: string | null) {
  // The bar renders nothing until AI status arrives in the browser, so reading storage on the
  // first render cannot mismatch the server's HTML. A store switch reloads the admin.
  const [turns, setTurns] = useState<AssistantTurn[]>(() =>
    typeof window === 'undefined' ? [] : load(storeId),
  )
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    save(storeId, turns)
  }, [storeId, turns])

  const update = (id: string, fn: (turn: AssistantTurn) => AssistantTurn) =>
    setTurns((all) => all.map((t) => (t.id === id ? fn(t) : t)))

  const send = async (message: string, page: AssistantPageContext, language: 'en' | 'hi') => {
    const text = message.trim().slice(0, ASSISTANT_MAX_MESSAGE)
    if (!text || controller.current) return
    const abort = new AbortController()
    controller.current = abort
    const id = `${Date.now()}`
    const history = historyOf(turns)
    setTurns((all) => [
      ...all.slice(-(MAX_TURNS - 1)),
      { id, message: text, answer: '', sources: [], actions: [], status: 'streaming', error: null },
    ])
    try {
      const events = await api.ai.assistant(
        { message: text, history, page, language },
        { signal: abort.signal },
      )
      for await (const event of events) update(id, (t) => applyEvent(t, event))
      update(id, (t) => (t.status === 'streaming' ? { ...t, status: 'done' } : t))
    } catch (err) {
      const stopped = abort.signal.aborted
      update(id, (t) => ({
        ...t,
        status: stopped ? 'stopped' : 'error',
        error: stopped ? null : err instanceof Error ? err.message : null,
      }))
    } finally {
      controller.current = null
    }
  }

  const stop = () => controller.current?.abort()

  const clear = () => {
    controller.current?.abort()
    setTurns([])
  }

  /** A card's action after Approve, Edit, Cancel or Undo. */
  const replaceAction = (view: ActionView) =>
    setTurns((all) =>
      all.map((t) =>
        t.actions.some((a) => a.id === view.id)
          ? { ...t, actions: t.actions.map((a) => (a.id === view.id ? view : a)) }
          : t,
      ),
    )

  const busy = turns.some((t) => t.status === 'streaming')
  return { turns, busy, send, stop, clear, replaceAction }
}
