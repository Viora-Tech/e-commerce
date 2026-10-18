import { describe, expect, it } from 'vitest'
import { channelOfAttribution, parseSalesChannels } from './client'
import { catalogReadiness, type ReadinessProduct } from './readiness'

const words = (n: number) => Array.from({ length: n }, () => 'word').join(' ')

const ready: ReadinessProduct = {
  id: 'p1',
  title: 'Abyss Gaming Veil Glasspad',
  bodyText: words(60),
  imageCount: 4,
  vendor: 'Waimers',
  hasBarcode: true,
  hasCategory: true,
}

const ALL_POLICIES = ['refund-policy', 'shipping-policy', 'terms-of-service'] as const

describe('channelOfAttribution', () => {
  it('reads AI assistants and social apps from the referrer or utm_source', () => {
    expect(channelOfAttribution({ referrer: 'chatgpt.com' })).toBe('chatgpt')
    expect(channelOfAttribution({ referrer: 'www.perplexity.ai' })).toBe('perplexity')
    expect(channelOfAttribution({ referrer: 'l.instagram.com' })).toBe('instagram')
    expect(channelOfAttribution({ source: 'FB' })).toBe('facebook')
    expect(channelOfAttribution({ channel: 'whatsapp' })).toBe('whatsapp')
    expect(channelOfAttribution({ source: 'google', medium: 'organic_shopping' })).toBe('google')
  })

  it('leaves search, direct and unknown visits out', () => {
    expect(channelOfAttribution({ source: 'google', medium: 'organic' })).toBeNull()
    expect(channelOfAttribution({ referrer: 'news.example.com' })).toBeNull()
    expect(channelOfAttribution(null)).toBeNull()
  })
})

describe('parseSalesChannels', () => {
  it('defaults missing or broken settings', () => {
    const s = parseSalesChannels({ salesChannels: { agents: { checkout: 'nope' } } })
    expect(s.agents.checkout).toBe('store')
    expect(s.agents.hiddenTags).toEqual(['no-ai'])
    expect(parseSalesChannels(null).channels).toEqual({})
  })
})

describe('catalogReadiness', () => {
  it('scores a complete catalog 100 with nothing to fix', () => {
    const r = catalogReadiness([ready], ALL_POLICIES)
    expect(r.score).toBe(100)
    expect(r.issues).toEqual([])
    expect(r.aiFixable).toEqual([])
  })

  it('flags thin products, worst first', () => {
    const thin: ReadinessProduct = {
      ...ready,
      id: 'p2',
      title: 'Kaze Wireless Mouse',
      bodyText: words(18),
      imageCount: 1,
      vendor: null,
      hasBarcode: false,
      hasCategory: false,
    }
    const r = catalogReadiness([ready, thin], ['shipping-policy', 'terms-of-service'])
    expect(r.issues.map((i) => [i.severity, i.rule])).toEqual([
      ['high', 'no_identifier'],
      ['high', 'no_refund_policy'],
      ['medium', 'short_description'],
      ['medium', 'few_images'],
      ['low', 'no_category'],
    ])
    expect(r.counts).toEqual({ high: 2, medium: 2, low: 1 })
    expect(r.aiFixable).toEqual(['p2'])
    expect(r.parts.images).toBe(67)
    expect(r.score).toBeLessThan(100)
  })

  it('still scores an empty catalog by its policies', () => {
    expect(catalogReadiness([], []).parts.policies).toBe(0)
  })
})
