import { describe, expect, it } from 'vitest'
import { type AiRuntime, generateStructured } from '../src/engine'
import {
  STORE_KNOWLEDGE_MAX_OUTPUT_TOKENS,
  StoreKnowledgeSchema,
  storeKnowledgeContent,
  storeKnowledgeInstructions,
} from '../src/store-knowledge'
import { textModel } from '../src/testing'

const runtime: AiRuntime = {
  storeId: 'store-a',
  userId: 'user-1',
  plan: 'starter',
  feature: 'productWriter',
}

const many = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix} ${i + 1}`)

/** What a real model returns for a store with many brands: longer lists than the page keeps. */
const realistic = {
  description: 'Waimers sells gaming mice, keyboards and glass mouse pads online across India.',
  audience: 'PC gamers and esports players in India.',
  founded: '',
  location: 'Based in India and ships from Delhi.',
  brands: many('Brand', 25),
  categories: many('Category', 18),
  values: ['Genuine products', 'Fast support'],
  style: '',
  shipping: 'Ships across India; delivery takes 2-7 days.',
  payments: 'UPI, cards and cash on delivery.',
  returns: 'Returns within 7 days of delivery for unused products.',
  support: 'Email and WhatsApp, Monday to Saturday.',
  faq: Array.from({ length: 9 }, (_, i) => ({ q: `Question ${i + 1}?`, a: `Answer ${i + 1}.` })),
}

const scan = (text: string) =>
  generateStructured({
    runtime,
    model: textModel(text),
    schema: StoreKnowledgeSchema,
    instructions: storeKnowledgeInstructions('Waimers'),
    content: storeKnowledgeContent({
      storeName: 'Waimers',
      description: '',
      aboutPage: '',
      policies: [],
      brands: many('Brand', 25).map((name) => ({ name, products: 3 })),
      types: [],
      collections: [],
      sampleTitles: [],
    }),
    maxOutputTokens: STORE_KNOWLEDGE_MAX_OUTPUT_TOKENS,
  })

describe('store knowledge scan', () => {
  it('accepts a model answer with more brands, categories and questions than the page keeps', async () => {
    // The scan sends up to 25 brands, 20 types and 30 collections; the model lists them all.
    // The knowledge base trims to 12 tags and 8 questions afterwards (cleanValue in core).
    const { output } = await scan(JSON.stringify(realistic))
    expect(output.brands).toHaveLength(25)
    expect(output.faq).toHaveLength(9)
  })

  it('sends the model a schema without array or length limits', async () => {
    const model = textModel(JSON.stringify(realistic))
    await generateStructured({
      runtime,
      model,
      schema: StoreKnowledgeSchema,
      instructions: 'x',
      content: [{ type: 'text', text: 'x' }],
    })
    const format = model.doGenerateCalls[0]?.responseFormat
    const schema = JSON.stringify(format && 'schema' in format ? format.schema : {})
    for (const keyword of ['maxItems', 'minItems', 'maxLength', 'minLength', 'pattern']) {
      expect(schema).not.toContain(keyword)
    }
  })

  it('gives the scan a bigger output budget than a product write', async () => {
    const model = textModel(JSON.stringify(realistic))
    await generateStructured({
      runtime,
      model,
      schema: StoreKnowledgeSchema,
      instructions: 'x',
      content: [{ type: 'text', text: 'x' }],
      maxOutputTokens: STORE_KNOWLEDGE_MAX_OUTPUT_TOKENS,
    })
    expect(model.doGenerateCalls[0]?.maxOutputTokens).toBe(STORE_KNOWLEDGE_MAX_OUTPUT_TOKENS)
    expect(STORE_KNOWLEDGE_MAX_OUTPUT_TOKENS).toBeGreaterThanOrEqual(4_000)
  })

  it('throws on a cut-off answer, so the API reports the scan as failed', async () => {
    const cut = JSON.stringify(realistic).slice(0, 400)
    await expect(scan(cut)).rejects.toThrow()
  })
})
