/**
 * "Refine with AI" under the custom query editor (Analytics → Reports → Custom query): the
 * merchant's request and the current query in, new query text out. The model's answer is only
 * text: it is parsed here (one retry with the parser's error), and nothing runs until the
 * editor sends it through `analytics.query`, which parses it again and runs fixed SQL only.
 * Runs under the assistant's switch and monthly allowance (Settings → AI).
 */
import {
  generateStructured,
  QueryWriterSchema,
  queryWriterContent,
  queryWriterInstructions,
} from '@commerce/ai'
import {
  formatQuery,
  parseQuery,
  type QueryError,
  queryLanguageReference,
} from '@commerce/core/analytics-query'
import { ORPCError } from '@orpc/server'
import { type AiCallContext, finishAiCall, startAiCall } from './guard'

/** One model answer for a request, told what was wrong with the last one when retrying. */
export type QueryAsk = (problem?: { query: string; error: string }) => Promise<string>

export type WrittenQuery = { ok: true; source: string } | { ok: false; error: QueryError }

const errorText = (e: QueryError) =>
  `line ${e.line}: ${e.message}${e.suggestion ? ` Did you mean ${e.suggestion}?` : ''}`

/** Asks once, and once more with the parser's error; returns the query formatted, or the last error. */
export async function writeValidQuery(ask: QueryAsk): Promise<WrittenQuery> {
  let problem: { query: string; error: string } | undefined
  let last: QueryError | null = null
  for (let attempt = 0; attempt < 2; attempt++) {
    const text = (await ask(problem)).trim()
    const parsed = parseQuery(text)
    if (parsed.ok) return { ok: true, source: formatQuery(parsed.query) }
    last = parsed.error
    problem = { query: text, error: errorText(parsed.error) }
  }
  return { ok: false, error: last as QueryError }
}

export async function refineQuery(
  context: AiCallContext,
  input: { request: string; current: string },
  signal?: AbortSignal,
): Promise<WrittenQuery> {
  const call = await startAiCall(context, 'assistant')
  const parsedCurrent = parseQuery(input.current)
  const current = parsedCurrent.ok ? formatQuery(parsedCurrent.query) : input.current
  const instructions = queryWriterInstructions(queryLanguageReference())
  const usage = { inputTokens: 0, outputTokens: 0 }
  try {
    return await writeValidQuery(async (problem) => {
      const out = await generateStructured({
        runtime: call.runtime,
        model: call.model,
        schema: QueryWriterSchema,
        instructions,
        content: queryWriterContent({ request: input.request, current, problem }),
        abortSignal: signal,
      })
      usage.inputTokens += out.usage.inputTokens
      usage.outputTokens += out.usage.outputTokens
      return out.output.query
    })
  } catch {
    throw new ORPCError('BAD_GATEWAY', {
      message: 'The AI could not write a query this time. Please try again.',
      data: { reason: 'model_failed' },
    })
  } finally {
    await finishAiCall(context.db, call, usage)
  }
}
