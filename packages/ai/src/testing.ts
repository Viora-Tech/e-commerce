/**
 * Test helpers for code that calls the AI engine: mock models that never reach a provider.
 * Used by this package's tests and the API's AI tests.
 */
import type { LanguageModelV4StreamPart } from '@ai-sdk/provider'
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'

export const MOCK_USAGE = {
  inputTokens: { total: 100, noCache: 100, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
}

/** A model whose one non-streamed answer is `text` (JSON for structured calls). */
export function textModel(text: string): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: 'text', text }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: MOCK_USAGE,
      warnings: [],
    }),
  })
}

export type MockStep = { toolCall: { name: string; input: unknown } } | { text: string }

function stepChunks(step: MockStep, index: number): LanguageModelV4StreamPart[] {
  if ('toolCall' in step) {
    return [
      {
        type: 'tool-call',
        toolCallId: `call-${index}`,
        toolName: step.toolCall.name,
        input: JSON.stringify(step.toolCall.input),
      },
      {
        type: 'finish',
        finishReason: { unified: 'tool-calls', raw: undefined },
        usage: MOCK_USAGE,
      },
    ]
  }
  return [
    { type: 'text-start', id: `t${index}` },
    { type: 'text-delta', id: `t${index}`, delta: step.text },
    { type: 'text-end', id: `t${index}` },
    { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage: MOCK_USAGE },
  ]
}

/** A streaming model that plays `steps` in order, one per model call (a tool call, then text). */
export function scriptedModel(steps: MockStep[]): MockLanguageModelV4 {
  let call = 0
  return new MockLanguageModelV4({
    doStream: async () => {
      const step = steps[Math.min(call, steps.length - 1)] as MockStep
      const chunks = stepChunks(step, call)
      call += 1
      return {
        stream: simulateReadableStream({ chunks, initialDelayInMs: null, chunkDelayInMs: null }),
      }
    },
  })
}
