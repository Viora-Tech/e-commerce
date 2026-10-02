/**
 * "Ask your store" (admin Home): a question in, a streamed answer out, built only from the
 * read-only store tools. Each yielded event is small and safe to send to the browser: text
 * deltas, which data was checked (with its facts, so the answer's numbers can be traced), and
 * a final `done`. Errors become one plain `error` event; prompts are never logged.
 */
import { type AiMessage, type AskLanguage, askStoreInstructions, streamAnswer } from '@commerce/ai'
import { formatInZone } from '@commerce/dates'
import { type AiCallContext, finishAiCall, startAiCall } from './guard'
import type { Fact } from './store-tools'
import { storeTools } from './store-tools'

export type AskStoreInput = {
  question: string
  history: AiMessage[]
  language: AskLanguage
}

export type AskStoreEvent =
  | { type: 'text'; delta: string }
  | {
      type: 'source'
      id: string
      tool: string
      status: 'running' | 'done' | 'failed'
      facts: Fact[]
    }
  | { type: 'error'; message: string }
  | { type: 'done' }

function factsOf(output: unknown): Fact[] {
  const facts = (output as { facts?: unknown } | null)?.facts
  return Array.isArray(facts)
    ? facts.filter((f): f is Fact => typeof f?.label === 'string' && typeof f?.value === 'string')
    : []
}

const FAILED = 'Sorry, I could not answer that just now. Please try again in a moment.'

/** Starts the call (gate, quota, metering) before the first byte, then streams the answer. */
export async function askStore(
  context: AiCallContext,
  input: AskStoreInput,
  signal?: AbortSignal,
): Promise<AsyncGenerator<AskStoreEvent>> {
  const call = await startAiCall(context, 'askStore')
  const today = formatInZone(
    new Date(),
    { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
    { timeZone: call.store.timezone },
  )
  const events = streamAnswer({
    runtime: call.runtime,
    model: call.model,
    instructions: askStoreInstructions({
      storeName: call.store.name,
      today,
      language: input.language,
    }),
    messages: [...input.history, { role: 'user', content: input.question }],
    tools: storeTools({ db: context.db, store: call.store, now: () => new Date() }),
    abortSignal: signal,
    onUsage: (usage) => finishAiCall(context.db, call, usage),
  })
  return (async function* () {
    try {
      for await (const event of events) {
        if (event.type === 'text') yield { type: 'text', delta: event.delta }
        else if (event.type === 'tool') {
          yield {
            type: 'source',
            id: event.id,
            tool: event.name,
            status: event.status,
            facts: event.status === 'done' ? factsOf(event.output) : [],
          }
        } else if (event.type === 'error') yield { type: 'error', message: FAILED }
      }
      yield { type: 'done' }
    } catch {
      yield { type: 'error', message: FAILED }
    }
  })()
}
