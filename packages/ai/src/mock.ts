/**
 * The built-in fake model behind `AI_PROVIDER=mock`: lets the AI features run end to end on a
 * laptop with no key (demos, screenshots, local testing). Deterministic, offline, and refused
 * in production by `aiProvider`. Unit tests build their own mocks instead.
 *
 * For the assistant it plans tool calls from the message and the page line in the system
 * prompt (`mockPlan`), one call per model step, then writes an answer from the last tool
 * result: facts become a short list, a proposal becomes "ready for you to approve".
 */
import type { LanguageModelV4CallOptions, LanguageModelV4StreamPart } from '@ai-sdk/provider'
import { simulateReadableStream } from 'ai'
import { MockLanguageModelV4 } from 'ai/test'
import { CAMPAIGN_WRITER_MARKER } from './campaign-writer'
import type { AiFeature } from './features'
import { INBOX_AGENT_MARKER } from './inbox-agent'
import { mockPlan } from './mock-plan'
import { MOCK_DOCUMENTS } from './purchase-documents/fixtures'
import {
  DOCUMENT_READ_MARKER,
  DOCUMENT_SHAPES,
  type DocumentShape,
} from './purchase-documents/schema'
import { QUERY_WRITER_MARKER } from './query-writer'
import { REVIEW_REPLY_MARKER } from './review-reply'
import { SECTION_WRITER_MARKER } from './section-writer'
import { SEO_KEYWORDS_MARKER } from './seo-keywords/prompt'

const USAGE = {
  inputTokens: { total: 1_200, noCache: 1_200, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 240, text: 240, reasoning: undefined },
}

type Prompt = LanguageModelV4CallOptions['prompt']

function lastUserIndex(prompt: Prompt): number {
  for (let i = prompt.length - 1; i >= 0; i--) if (prompt[i]?.role === 'user') return i
  return -1
}

function lastUserText(prompt: Prompt): string {
  const message = prompt[lastUserIndex(prompt)]
  if (message?.role !== 'user') return ''
  return message.content.map((part) => (part.type === 'text' ? part.text : '')).join('\n')
}

function systemText(prompt: Prompt): string {
  return prompt.flatMap((m) => (m.role === 'system' ? [m.content] : [])).join('\n')
}

function titleFrom(text: string): string {
  return /Title: (.+)/.exec(text)?.[1]?.trim() ?? 'This product'
}

function photoCount(prompt: Prompt): number {
  const message = prompt[lastUserIndex(prompt)]
  if (message?.role !== 'user') return 0
  return message.content.filter((part) => part.type === 'file').length
}

/** Canned keywords built from the product's title, the first one primary. */
function seoKeywords(prompt: Prompt): string {
  const title = titleFrom(lastUserText(prompt)).toLowerCase().split(' ').slice(0, 3).join(' ')
  return JSON.stringify({
    keywords: [
      { keyword: `${title} price`, intent: 'buy', primary: true },
      { keyword: `buy ${title} online`, intent: 'buy', primary: false },
      { keyword: `best ${title} under 2000`, intent: 'compare', primary: false },
      { keyword: `${title} for laptop`, intent: 'compare', primary: false },
      { keyword: `${title} sasta`, intent: 'buy', primary: false },
      { keyword: `how to clean ${title}`, intent: 'info', primary: false },
    ],
  })
}

function productCopy(prompt: Prompt): string {
  const text = lastUserText(prompt)
  const title = titleFrom(text)
  const keyword = /Primary search keyword: "(.+)"/.exec(text)?.[1]
  const photos = photoCount(prompt)
  const hindi = systemText(prompt).includes('Hindi')
  const altTexts = Array.from({ length: photos }, (_, i) =>
    hindi ? `${title}, फ़ोटो ${i + 1}` : `${title}, photo ${i + 1} of ${photos}`,
  )
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
      altTexts,
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
    seoTitle: keyword ? `${title}, ${keyword}` : `${title} | Buy online in India`,
    seoDescription: keyword
      ? `Looking for ${keyword}? ${title} has a sturdy, comfortable build and plug and play USB-C setup.`
      : `Shop ${title}: a sturdy, comfortable build with plug and play USB-C setup. Made for everyday use and long sessions.`,
    tags: ['gaming', 'desk setup', 'usb-c', 'accessories'],
    altTexts,
  })
}

/** The fixture for the shape named in a document reader's instructions. */
function documentRead(system: string): string {
  const named = /Document type: (\w+)/.exec(system)?.[1] as DocumentShape | undefined
  const shape = named && DOCUMENT_SHAPES.includes(named) ? named : 'service_bill'
  return JSON.stringify(MOCK_DOCUMENTS[shape])
}

/** A canned query for "Refine with AI": products or sales, top N when the request says so. */
function analyticsQuery(prompt: Prompt): string {
  const request = /Request: """(.*)"""/.exec(lastUserText(prompt))?.[1]?.toLowerCase() ?? ''
  const top = Number(/top (\d{1,3})/.exec(request)?.[1] ?? 10)
  const query = request.includes('product')
    ? `FROM products
  SHOW net_quantity, gross_sales
  GROUP BY product_title
  SINCE -30d UNTIL today
  ORDER BY net_quantity DESC
  LIMIT ${top}`
    : `FROM sales
  SHOW net_sales, orders
  GROUP BY state
  SINCE -1m UNTIL today
  ORDER BY net_sales DESC
  LIMIT ${top}`
  return JSON.stringify({ query })
}

/** The canned structured answer for whichever writer or reader made the call. */
function generated(prompt: Prompt): string {
  const system = systemText(prompt)
  if (system.includes(DOCUMENT_READ_MARKER)) return documentRead(system)
  if (system.includes(SEO_KEYWORDS_MARKER)) return seoKeywords(prompt)
  if (system.includes(QUERY_WRITER_MARKER)) return analyticsQuery(prompt)
  if (system.includes(CAMPAIGN_WRITER_MARKER)) {
    return JSON.stringify({
      subject: 'Something new for you',
      previewText: 'Fresh picks from the store, chosen for you.',
      heading: 'Picked for you',
      body: 'We have put together a few things we think you will like. Take a look while they last.',
      button: 'Shop now',
    })
  }
  if (system.includes(INBOX_AGENT_MARKER)) {
    return JSON.stringify({
      action: 'reply',
      reply: 'Happy to help. Tell me what you are looking for and I will find it for you.',
      productIds: [],
      handoffReason: null,
      summary: '',
      confidence: 80,
    })
  }
  if (system.includes(REVIEW_REPLY_MARKER)) {
    return JSON.stringify({
      reply:
        'Thank you for taking the time to write this. We are glad it works well for you, and we hope you enjoy it for a long time.',
    })
  }
  if (system.includes(SECTION_WRITER_MARKER)) {
    return JSON.stringify({
      summary: 'Questions shoppers often ask before they order, answered in one place.',
      section: {
        type: 'Faq',
        heading: 'Questions, answered',
        items: [
          {
            question: 'How long does delivery take?',
            answer: 'Most orders reach you in a few working days.',
          },
          {
            question: 'Can I return an item?',
            answer: 'Yes. See our returns page for how it works.',
          },
          {
            question: 'Do you offer cash on delivery?',
            answer: 'You can see every way to pay at checkout.',
          },
        ],
      },
    })
  }
  return productCopy(prompt)
}

type ToolValue = {
  facts?: { label: string; value: string }[]
  proposal?: { summary: string }
  error?: string
} | null

/** Tool results since the merchant's last message, oldest first. */
function resultsThisTurn(prompt: Prompt): ToolValue[] {
  return prompt.slice(lastUserIndex(prompt) + 1).flatMap((message) => {
    if (message.role !== 'tool') return []
    return message.content.flatMap((part) => {
      if (part.type !== 'tool-result' || part.output.type !== 'json') return []
      return [part.output.value as ToolValue]
    })
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

function answerFrom(results: ToolValue[], hindi: boolean): string {
  const proposals = results.flatMap((r) => (r?.proposal ? [r.proposal.summary] : []))
  if (proposals.length) {
    return hindi
      ? 'बदलाव नीचे तैयार है, जाँच लीजिए। जब तक आप मंज़ूर नहीं करते, स्टोर में कुछ नहीं बदलेगा।'
      : 'I have prepared the change below. Check it: nothing changes in your store until you approve it.'
  }
  const error = results.find((r) => r?.error)?.error
  if (error) return `I could not prepare that: ${error}`
  const facts = results.flatMap((r) => r?.facts ?? [])
  if (!facts.length) {
    return 'I can only answer from your store data, and I could not find a tool for that question.'
  }
  const lines = facts.map((f) => `- **${f.label}:** ${f.value}`).join('\n')
  return hindi
    ? `आपके स्टोर के आँकड़े:\n\n${lines}`
    : `Here is what your store data shows:\n\n${lines}\n\nAsk me to compare with another period, or about stock and orders.`
}

function answerStream(options: LanguageModelV4CallOptions): LanguageModelV4StreamPart[] {
  const available = (options.tools ?? []).map((t) => t.name)
  const system = systemText(options.prompt)
  const steps = mockPlan(lastUserText(options.prompt), system, available)
  const results = resultsThisTurn(options.prompt)
  const next = steps[results.length]
  const stuck = results.some((r) => r?.error)
  if (!next || stuck) return textStream(answerFrom(results, system.includes('Hindi (Devanagari)')))
  return [
    {
      type: 'tool-call',
      toolCallId: `call-${results.length}-${next.tool}`,
      toolName: next.tool,
      input: JSON.stringify(next.input),
    },
    { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage: USAGE },
  ]
}

/** A fake model for one feature: canned product copy or document readings, or planned tool calls followed by an answer from their results. */
export function mockModel(feature: AiFeature): MockLanguageModelV4 {
  return new MockLanguageModelV4({
    provider: 'mock',
    modelId: `mock-${feature}`,
    doGenerate: async (options) => ({
      content: [{ type: 'text', text: generated(options.prompt) }],
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
