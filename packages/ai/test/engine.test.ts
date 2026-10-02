import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  type AiRuntime,
  type AiStreamEvent,
  type AiUsage,
  defineAiTool,
  generateStructured,
  streamAnswer,
} from '../src/engine'
import { mockModel } from '../src/mock'
import { clampProductCopy, ProductCopySchema } from '../src/product-writer/schema'
import { scriptedModel, textModel } from '../src/testing'

const runtime = (feature: AiRuntime['feature']): AiRuntime => ({
  storeId: 'store-a',
  userId: 'user-1',
  plan: 'starter',
  feature,
})

async function collect(events: AsyncGenerator<AiStreamEvent>): Promise<AiStreamEvent[]> {
  const out: AiStreamEvent[] = []
  for await (const event of events) out.push(event)
  return out
}

describe('generateStructured', () => {
  it('returns the validated object and the token usage', async () => {
    const result = await generateStructured({
      runtime: runtime('productWriter'),
      model: textModel('{"name":"Mouse","count":3}'),
      schema: z.object({ name: z.string(), count: z.number() }),
      instructions: 'Return JSON.',
      content: [{ type: 'text', text: 'Title: Mouse' }],
    })
    expect(result.output).toEqual({ name: 'Mouse', count: 3 })
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 20 })
  })

  it('throws when the model does not follow the schema', async () => {
    await expect(
      generateStructured({
        runtime: runtime('productWriter'),
        model: textModel('{"name":42}'),
        schema: z.object({ name: z.string() }),
        instructions: 'Return JSON.',
        content: [{ type: 'text', text: 'x' }],
      }),
    ).rejects.toThrow()
  })

  it('sends photos to the model as image files', async () => {
    const model = textModel('{"ok":true}')
    await generateStructured({
      runtime: runtime('productWriter'),
      model,
      schema: z.object({ ok: z.boolean() }),
      instructions: 'Return JSON.',
      content: [
        { type: 'text', text: 'Look' },
        { type: 'image', data: new Uint8Array([1, 2, 3]), mediaType: 'image/webp' },
      ],
    })
    const user = model.doGenerateCalls[0]?.prompt.find((m) => m.role === 'user')
    expect(user?.content.map((p) => p.type)).toEqual(['text', 'file'])
  })
})

describe('streamAnswer', () => {
  it('runs a read tool with the runtime the API gave it, then streams the answer', async () => {
    const seen: { input: unknown; storeId: string }[] = []
    const usages: AiUsage[] = []
    const salesSummary = defineAiTool({
      description: 'Sales',
      input: z.object({ days: z.number() }),
      risk: 'read',
      run: async (input, rt) => {
        seen.push({ input, storeId: rt.storeId })
        return { facts: [{ label: 'Sales', value: '₹1,200' }] }
      },
    })
    const events = await collect(
      streamAnswer({
        runtime: runtime('assistant'),
        model: scriptedModel([
          // The model tries to name another store; tools never read it from the input.
          { toolCall: { name: 'salesSummary', input: { days: 7, storeId: 'store-b' } } },
          { text: 'Sales were ₹1,200.' },
        ]),
        instructions: 'Answer.',
        messages: [{ role: 'user', content: 'How were sales?' }],
        tools: { salesSummary },
        onUsage: async (u) => {
          usages.push(u)
        },
      }),
    )
    expect(seen).toEqual([{ input: { days: 7 }, storeId: 'store-a' }])
    expect(events.map((e) => e.type)).toEqual(['tool', 'tool', 'text', 'finish'])
    expect(events[1]).toMatchObject({ status: 'done', output: { facts: [{ value: '₹1,200' }] } })
    expect(events.at(-1)).toEqual({ type: 'finish', usage: { inputTokens: 200, outputTokens: 40 } })
    expect(usages).toEqual([{ inputTokens: 200, outputTokens: 40 }])
  })

  it('asks for approval instead of running a write tool', async () => {
    let ran = false
    const cancelOrder = defineAiTool({
      description: 'Cancel an order',
      input: z.object({ number: z.number() }),
      risk: 'write',
      run: async () => {
        ran = true
        return { ok: true }
      },
    })
    const events = await collect(
      streamAnswer({
        runtime: runtime('assistant'),
        model: scriptedModel([{ toolCall: { name: 'cancelOrder', input: { number: 1001 } } }]),
        instructions: 'Answer.',
        messages: [{ role: 'user', content: 'Cancel order 1001' }],
        tools: { cancelOrder },
      }),
    )
    expect(ran).toBe(false)
    expect(events.find((e) => e.type === 'approval')).toMatchObject({
      name: 'cancelOrder',
      input: { number: 1001 },
    })
  })

  it('still reports usage when the reader stops early', async () => {
    const usages: AiUsage[] = []
    const stream = streamAnswer({
      runtime: runtime('assistant'),
      model: scriptedModel([{ text: 'Hello there' }]),
      instructions: 'Answer.',
      messages: [{ role: 'user', content: 'Hi' }],
      tools: {},
      onUsage: async (u) => {
        usages.push(u)
      },
    })
    await stream.next()
    await stream.return(undefined)
    expect(usages).toHaveLength(1)
  })
})

describe('the built-in mock model', () => {
  it('writes product copy that fits the schema', async () => {
    const { output } = await generateStructured({
      runtime: runtime('productWriter'),
      model: mockModel('productWriter'),
      schema: ProductCopySchema,
      instructions: 'Write in clear Indian English.',
      content: [{ type: 'text', text: 'Title: Glide Mouse' }],
    })
    expect(output.seoTitle).toContain('Glide Mouse')
    expect(clampProductCopy(output).seoTitle.length).toBeLessThanOrEqual(70)
  })

  it('calls a matching tool, then answers from its facts', async () => {
    const lowStock = defineAiTool({
      description: 'Low stock',
      input: z.object({}),
      risk: 'read',
      run: async () => ({ facts: [{ label: 'Running low', value: '3 products' }] }),
    })
    const events = await collect(
      streamAnswer({
        runtime: runtime('assistant'),
        model: mockModel('assistant'),
        instructions: 'Answer.',
        messages: [{ role: 'user', content: "What's running out?" }],
        tools: { lowStock },
      }),
    )
    const text = events.flatMap((e) => (e.type === 'text' ? [e.delta] : [])).join('')
    expect(text).toContain('3 products')
  })
})

describe('clampProductCopy', () => {
  it('trims long fields and drops duplicate or empty tags', () => {
    const copy = clampProductCopy({
      intro: 'a'.repeat(2000),
      highlights: Array.from({ length: 10 }, (_, i) => `point ${i}`),
      closing: '',
      specsTitle: 'Key specs',
      specs: [{ label: 'Weight', value: '' }],
      seoTitle: 'word '.repeat(30),
      seoDescription: 'x',
      tags: ['RGB', 'rgb', ' '],
      altTexts: ['A mouse on a desk', '', 'x'.repeat(300), 'four', 'five'],
    })
    expect(copy.intro.length).toBeLessThanOrEqual(900)
    expect(copy.highlights).toHaveLength(6)
    expect(copy.specs).toEqual([])
    expect(copy.seoTitle.length).toBeLessThanOrEqual(70)
    expect(copy.tags).toEqual(['rgb'])
    expect(copy.altTexts).toHaveLength(3)
    expect(copy.altTexts[0]).toBe('A mouse on a desk')
    expect(copy.altTexts[1]?.length).toBeLessThanOrEqual(125)
  })
})
