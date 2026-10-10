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

/**
 * A one-page PDF with `lines` as real text (Helvetica, top to bottom), built by hand so tests
 * need no PDF library. Only ASCII; parentheses and backslashes are escaped.
 */
export function textPdf(lines: string[]): Uint8Array<ArrayBuffer> {
  const pdfString = (s: string) => s.replace(/[\\()]/g, (c) => `\\${c}`)
  const stream = [
    'BT /F1 11 Tf 14 TL 50 790 Td',
    ...lines.map((line) => `(${pdfString(line)}) Tj T*`),
    'ET',
  ].join('\n')
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let body = '%PDF-1.4\n'
  const offsets: number[] = []
  for (const [i, object] of objects.entries()) {
    offsets.push(body.length)
    body += `${i + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets) body += `${String(offset).padStart(10, '0')} 00000 n \n`
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(body)
}
