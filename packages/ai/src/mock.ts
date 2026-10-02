/**
 * The built-in fake model behind `AI_PROVIDER=mock`: lets the AI features run end to end on a
 * laptop with no key (demos, screenshots, local testing). Deterministic, offline, and refused
 * in production by `aiProvider`. Unit tests build their own mocks instead.
 */
import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from '@ai-sdk/provider'
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import type { AiFeature } from './features'

const USAGE = {
  inputTokens: { total: 1_200, noCache: 1_200, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 240, text: 240, reasoning: undefined },
}

type Prompt = LanguageModelV4CallOptions['prompt']

function lastUserText(prompt: Prompt): string {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const message = prompt[i]
    if (message?.role !== 'user') continue
    return message.content.map((part) => (part.type === 'text' ? part.text : '')).join('\n')
  }
  return ''
}

function titleFrom(text: string): string {
  return /Title: (.+)/.exec(text)?.[1]?.trim() ?? 'This product'
}

function productCopy(prompt: Prompt): string {
  const text = lastUserText(prompt)
  const title = titleFrom(text)
  const hindi = prompt.some((m) => m.role === 'system' && m.content.includes('Hindi'))
  if (hindi) {
    return JSON.stringify({
      intro: `${title} रोज़ के इस्तेमाल के लिए बनाया गया है। मज़बूत बनावट, साफ़ डिज़ाइन और आसान सेटअप, ताकि आप बिना झंझट के काम शुरू कर सकें।`,
      highlights: ['हल्का और मज़बूत', 'आसान सेटअप, कोई ड्राइवर नहीं', 'रोज़ के इस्तेमाल के लिए आरामदायक'],
      closing: 'अपने सेटअप को आज ही बेहतर बनाइए।',
      specsTitle: 'मुख्य जानकारी',
      specs: [{ label: 'कनेक्शन', value: 'USB-C' }],
      seoTitle: `${title} | ऑनलाइन खरीदें`,
      seoDescription: `${title}: मज़बूत बनावट, आसान सेटअप और रोज़ के इस्तेमाल के लिए आरामदायक डिज़ाइन। आज ही ऑर्डर करें।`,
      tags: ['gaming', 'setup', 'accessories', 'usb-c'],
    })
  }
  return JSON.stringify({
    intro: `${title} is built for long sessions and everyday use. A solid build, a clean look and a setup that takes seconds, so you can get straight to what matters.`,
    highlights: [
      'Light, sturdy build that stays put on your desk',
      'Plug and play over USB-C, no drivers needed',
      'Comfortable for hours of daily use',
      'Clean design that fits any setup',
    ],
    closing: 'An easy upgrade for your setup.',
    specsTitle: 'Key specs',
    specs: [
      { label: 'Connection', value: 'USB-C' },
      { label: 'Compatibility', value: 'Windows, macOS' },
    ],
    seoTitle: `${title} | Buy online in India`,
    seoDescription: `Shop ${title}: a sturdy, comfortable build with plug and play USB-C setup. Made for everyday use and long sessions.`,
    tags: ['gaming', 'desk setup', 'usb-c', 'accessories'],
  })
}

const TOOL_HINTS: { pattern: RegExp; tool: string; input: Record<string, unknown> }[] = [
  { pattern: /stock|running out|restock/i, tool: 'lowStock', input: {} },
  { pattern: /waiting|pending|ship|days/i, tool: 'pendingOrders', input: { olderThanDays: 2 } },
  { pattern: /abandon|cart/i, tool: 'abandonedCheckouts', input: { days: 7 } },
  { pattern: /top|best|selling/i, tool: 'topProducts', input: { days: 30, limit: 5 } },
]

function pickTool(text: string, available: string[]): { tool: string; input: unknown } | null {
  const hint = TOOL_HINTS.find((h) => h.pattern.test(text) && available.includes(h.tool))
  if (hint) return { tool: hint.tool, input: hint.input }
  if (available.includes('salesSummary')) return { tool: 'salesSummary', input: { days: 7 } }
  return null
}

/** Reads `{ facts: [{ label, value }] }` out of the latest tool result, the shape our tools return. */
function factsFrom(prompt: Prompt): { label: string; value: string }[] {
  const last = prompt[prompt.length - 1]
  if (last?.role !== 'tool') return []
  return last.content.flatMap((part) => {
    if (part.type !== 'tool-result' || part.output.type !== 'json') return []
    const value = part.output.value as { facts?: { label: string; value: string }[] } | null
    return value?.facts ?? []
  })
}

function textStream(text: string): LanguageModelV4StreamPart[] {
  const words = text.split(/(?<= )/)
  return [
    { type: 'text-start', id: 't1' },
    ...words.map((delta) => ({ type: 'text-delta' as const, id: 't1', delta })),
    { type: 'text-end', id: 't1' },
    { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage: USAGE },
  ]
}

function answerStream(options: LanguageModelV4CallOptions): LanguageModelV4StreamPart[] {
  const facts = factsFrom(options.prompt)
  if (facts.length) {
    const lines = facts.map((f) => `- **${f.label}:** ${f.value}`).join('\n')
    return textStream(
      `Here is what your store data shows:\n\n${lines}\n\nAsk me to compare with another period, or about stock and orders.`,
    )
  }
  const available = (options.tools ?? []).map((t) => t.name)
  const pick = pickTool(lastUserText(options.prompt), available)
  if (!pick)
    return textStream(
      'I can only answer from your store data, and I could not find a tool for that question.',
    )
  return [
    {
      type: 'tool-call',
      toolCallId: `call-${pick.tool}`,
      toolName: pick.tool,
      input: JSON.stringify(pick.input),
    },
    { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage: USAGE },
  ]
}

/** A fake model for one feature: canned product copy, or a tool call followed by an answer built from the tool's facts. */
export function mockModel(feature: AiFeature): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    provider: 'mock',
    modelId: `mock-${feature}`,
    doGenerate: async (options) => ({
      content: [{ type: 'text', text: productCopy(options.prompt) }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: USAGE,
      warnings: [],
    }),
    doStream: async (options) => ({
      stream: simulateReadableStream({
        chunks: answerStream(options),
        initialDelayInMs: 300,
        chunkDelayInMs: 25,
      }),
    }),
  })
}
