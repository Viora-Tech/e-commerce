/** SOURCE OF TRUTH: tests for the store knowledge base and what agents read — WHAT: parsing, cleaning, scan merges, fact lines, product grouping and policy answers / WHY: a scan must never overwrite what the merchant published. */
import { describe, expect, it } from 'vitest'
import { type AgentStoreInfo, answerFromStoreInfo, groupAgentProducts } from './agent-store'
import type { ChannelItem } from './catalog'
import {
  cleanValue,
  EMPTY_KNOWLEDGE,
  factLines,
  knowledgeCounts,
  mergeDraft,
  parseAgentKnowledge,
  publishedFacts,
} from './knowledge'

const NOW = '2026-11-17T10:00:00.000Z'

describe('store knowledge', () => {
  it('drops broken and unknown facts when parsing', () => {
    const k = parseAgentKnowledge({
      agentKnowledge: {
        facts: {
          description: { text: 'Sells glasspads', published: true },
          nonsense: { text: 'x' },
          audience: { text: '' },
        },
        scannedAt: NOW,
      },
    })
    expect(Object.keys(k.facts)).toEqual(['description'])
    expect(k.facts.description?.source).toBe('ai')
    expect(parseAgentKnowledge(null)).toEqual(EMPTY_KNOWLEDGE)
  })

  it('keeps only the part of a value its kind uses', () => {
    expect(cleanValue('brands', { text: 'x', tags: [' Pulsar ', 'Pulsar', 'Wooting'] })).toEqual({
      text: '',
      tags: ['Pulsar', 'Wooting'],
      faq: [],
    })
    expect(
      cleanValue('faq', {
        faq: [
          { q: 'COD?', a: '' },
          { q: 'COD?', a: 'Yes' },
        ],
      }).faq,
    ).toEqual([{ q: 'COD?', a: 'Yes' }])
  })

  it('a scan never overwrites published or merchant facts', () => {
    const current = parseAgentKnowledge({
      agentKnowledge: {
        facts: {
          description: { text: 'Mine', published: true, source: 'ai' },
          audience: { text: 'Gamers', published: false, source: 'merchant' },
          location: { text: 'Old draft', published: false, source: 'ai' },
        },
      },
    })
    const next = mergeDraft(
      current,
      {
        description: { text: 'New' },
        audience: { text: 'New' },
        location: { text: 'Delhi' },
        founded: { text: '' },
        brands: { tags: ['Pulsar'] },
      },
      NOW,
    )
    expect(next.facts.description?.text).toBe('Mine')
    expect(next.facts.audience?.text).toBe('Gamers')
    expect(next.facts.location).toMatchObject({ text: 'Delhi', published: false, updatedAt: NOW })
    expect(next.facts.founded).toBeUndefined()
    expect(next.facts.brands?.tags).toEqual(['Pulsar'])
    expect(next.scannedAt).toBe(NOW)
    expect(knowledgeCounts(next)).toEqual({ published: 1, total: 4 })
    expect(publishedFacts(next).map((f) => f.key)).toEqual(['description'])
  })

  it('writes facts as plain lines', () => {
    expect(factLines('brands', { text: '', tags: ['Pulsar', 'Lofree'], faq: [] })).toEqual([
      'Brands sold: Pulsar, Lofree',
    ])
    expect(factLines('faq', { text: '', tags: [], faq: [{ q: 'COD?', a: 'Yes' }] })).toEqual([
      'Q: COD?',
      'A: Yes',
    ])
  })
})

const item = (over: Partial<ChannelItem>): ChannelItem => ({
  id: 'v1',
  groupId: 'p1',
  title: 'Glasspad',
  description: 'A glass mousepad.',
  link: 'https://shop.test/products/glasspad',
  imageLink: null,
  additionalImages: [],
  pricePaise: 299900,
  mrpPaise: null,
  availability: 'in_stock',
  quantity: 5,
  brand: 'Pulsar',
  gtin: null,
  sku: null,
  ...over,
})

describe('agent products', () => {
  it('groups variants into products in search order', () => {
    const items = [
      item({ id: 'a1', groupId: 'a', title: 'Mouse', link: 'https://shop.test/products/mouse' }),
      item({
        id: 'b1',
        groupId: 'b',
        title: 'Pad - Black',
        link: 'https://shop.test/products/pad?variant=b1',
        pricePaise: 100000,
      }),
      item({
        id: 'b2',
        groupId: 'b',
        title: 'Pad - White',
        link: 'https://shop.test/products/pad?variant=b2',
        pricePaise: 120000,
        availability: 'out_of_stock',
      }),
    ]
    const products = groupAgentProducts(items, ['pad', 'mouse'])
    expect(products.map((p) => p.title)).toEqual(['Pad', 'Mouse'])
    expect(products[0]).toMatchObject({
      url: 'https://shop.test/products/pad',
      priceRange: { min: '1000.00', max: '1200.00', currency: 'INR' },
      available: true,
    })
    expect(products[0]?.variants.map((v) => [v.title, v.available])).toEqual([
      ['Black', true],
      ['White', false],
    ])
  })
})

describe('policy answers', () => {
  const info: AgentStoreInfo = {
    name: 'Shop',
    url: 'https://shop.test',
    facts: ['Shipping: Ships across India in 3 to 5 days.', 'Brands sold: Pulsar'],
    policies: [
      {
        title: 'Refund policy',
        url: 'https://shop.test/policies/refund-policy',
        text: 'Returns within 7 days.\nRefunds go to the original payment method.',
      },
      {
        title: 'Privacy policy',
        url: 'https://shop.test/policies/privacy-policy',
        text: 'We keep data safe.',
      },
    ],
  }

  it('finds the facts and passages that match the question', () => {
    const a = answerFromStoreInfo(info, 'how many days for returns?')
    expect(a.facts).toEqual(['Shipping: Ships across India in 3 to 5 days.'])
    expect(a.policies.map((p) => p.title)).toEqual(['Refund policy'])
    expect(a.policies[0]?.text).toContain('Returns within 7 days.')
  })

  it('gives every fact and only policy links without a question', () => {
    const a = answerFromStoreInfo(info, '')
    expect(a.facts).toHaveLength(2)
    expect(a.policies.every((p) => p.text === '')).toBe(true)
  })
})
