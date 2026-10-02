/**
 * SOURCE OF TRUTH: the AI engine — WHAT our small interface over the Vercel AI SDK
 * (structured output, streamed answers with tools, approvals for risky tools) / WHY features
 * never import the SDK directly, so a provider or SDK change is one file.
 *
 * Every call carries an `AiRuntime` (store, member, plan, feature). Tools receive it from
 * the engine, never from the model, so a tool always runs for the caller's store. Nothing
 * here logs prompts or outputs.
 */
import { generateText, isStepCount, type LanguageModel, Output, streamText, tool } from 'ai'
import type { z } from 'zod'
import { type AiFeature, FEATURE_MODELS } from './features'
import type { AiPlan } from './plans'

/** Who and what one AI call is for. Built by the API from the signed-in member's scope. */
export type AiRuntime = {
  storeId: string
  userId: string
  plan: AiPlan
  feature: AiFeature
}

export type AiContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: Uint8Array; mediaType: string }

export type AiMessage = { role: 'user' | 'assistant'; content: string }

export type AiUsage = { inputTokens: number; outputTokens: number }

/**
 * A tool the model may call. `read` tools run straight away; `write` tools (anything that
 * changes data, spends money or messages someone) are never run by the model: the engine
 * emits an `approval` event and stops, and the merchant decides.
 */
export type AiTool<I = unknown, O = unknown> = {
  description: string
  input: z.ZodType<I>
  risk: 'read' | 'write'
  run: (input: I, runtime: AiRuntime) => Promise<O>
}

export type AiToolSet = Record<string, AiTool>

/** Typed helper so a tool's `run` sees its parsed input. */
export function defineAiTool<I, O>(definition: AiTool<I, O>): AiTool {
  return definition as unknown as AiTool
}

export type AiStreamEvent =
  | { type: 'text'; delta: string }
  | {
      type: 'tool'
      id: string
      name: string
      status: 'running' | 'done' | 'failed'
      output?: unknown
    }
  | { type: 'approval'; id: string; name: string; input: unknown }
  | { type: 'error' }
  | { type: 'finish'; usage: AiUsage }

const ZERO: AiUsage = { inputTokens: 0, outputTokens: 0 }

function addUsage(
  a: AiUsage,
  b: { inputTokens?: number | undefined; outputTokens?: number | undefined },
): AiUsage {
  return {
    inputTokens: a.inputTokens + (b.inputTokens ?? 0),
    outputTokens: a.outputTokens + (b.outputTokens ?? 0),
  }
}

function toParts(content: AiContent[]) {
  return content.map((part) =>
    part.type === 'text'
      ? { type: 'text' as const, text: part.text }
      : { type: 'file' as const, mediaType: part.mediaType, data: part.data },
  )
}

/**
 * One structured answer: the model must return `schema`, validated before it comes back.
 * Throws when the model's output does not fit the schema or the provider fails.
 */
export async function generateStructured<T>(opts: {
  runtime: AiRuntime
  model: LanguageModel
  schema: z.ZodType<T>
  instructions: string
  content: AiContent[]
  abortSignal?: AbortSignal | undefined
}): Promise<{ output: T; usage: AiUsage }> {
  const settings = FEATURE_MODELS[opts.runtime.feature]
  const result = await generateText({
    model: opts.model,
    instructions: opts.instructions,
    messages: [{ role: 'user', content: toParts(opts.content) }],
    output: Output.object({ schema: opts.schema }),
    maxOutputTokens: settings.maxOutputTokens,
    temperature: settings.temperature,
    maxRetries: 1,
    ...(opts.abortSignal ? { abortSignal: opts.abortSignal } : {}),
  })
  return { output: result.output as T, usage: addUsage(ZERO, result.usage) }
}

function sdkTools(tools: AiToolSet, runtime: AiRuntime) {
  return Object.fromEntries(
    Object.entries(tools).map(([name, t]) => [
      name,
      tool({
        description: t.description,
        inputSchema: t.input,
        execute: (input: unknown) => t.run(input, runtime),
      }),
    ]),
  )
}

/**
 * A streamed answer that may call `tools` along the way (up to the feature's `maxSteps`).
 * Yields text deltas, tool progress and, last, the token usage. `onUsage` also runs when the
 * caller stops reading early (the browser went away), so metering never misses a call.
 */
export async function* streamAnswer(opts: {
  runtime: AiRuntime
  model: LanguageModel
  instructions: string
  messages: AiMessage[]
  tools: AiToolSet
  abortSignal?: AbortSignal | undefined
  onUsage?: ((usage: AiUsage) => Promise<void>) | undefined
}): AsyncGenerator<AiStreamEvent> {
  const settings = FEATURE_MODELS[opts.runtime.feature]
  const approvals = Object.fromEntries(
    Object.entries(opts.tools)
      .filter(([, t]) => t.risk === 'write')
      .map(([name]) => [name, 'user-approval' as const]),
  )
  let usage = ZERO
  try {
    const result = streamText({
      model: opts.model,
      instructions: opts.instructions,
      messages: opts.messages,
      tools: sdkTools(opts.tools, opts.runtime),
      toolApproval: approvals,
      stopWhen: isStepCount(settings.maxSteps),
      maxOutputTokens: settings.maxOutputTokens,
      temperature: settings.temperature,
      maxRetries: 1,
      ...(opts.abortSignal ? { abortSignal: opts.abortSignal } : {}),
    })
    for await (const part of result.fullStream) {
      switch (part.type) {
        case 'text-delta':
          if (part.text) yield { type: 'text', delta: part.text }
          break
        case 'tool-call':
          yield { type: 'tool', id: part.toolCallId, name: part.toolName, status: 'running' }
          break
        case 'tool-result':
          yield {
            type: 'tool',
            id: part.toolCallId,
            name: part.toolName,
            status: 'done',
            output: part.output,
          }
          break
        case 'tool-error':
          yield { type: 'tool', id: part.toolCallId, name: part.toolName, status: 'failed' }
          break
        case 'tool-approval-request':
          yield {
            type: 'approval',
            id: part.approvalId,
            name: part.toolCall.toolName,
            input: part.toolCall.input,
          }
          break
        case 'finish-step':
          usage = addUsage(usage, part.usage)
          break
        case 'error':
          yield { type: 'error' }
          break
        default:
          break
      }
    }
    yield { type: 'finish', usage }
  } finally {
    await opts.onUsage?.(usage)
  }
}
