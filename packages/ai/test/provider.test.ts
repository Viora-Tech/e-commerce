import { describe, expect, it } from 'vitest'
import { parseFeatureToggles, TIER_CALL_WEIGHT, tierFor } from '../src/features'
import { aiModel, aiProvider, isUnlimitedStore, modelIdFor, modelIdForTier } from '../src/provider'

describe('aiProvider', () => {
  it('is off with no key', () => {
    expect(aiProvider({})).toBeNull()
    expect(aiModel('assistant', {})).toBeNull()
  })

  it('picks the gateway whose key is set, Vercel first', () => {
    expect(aiProvider({ AI_GATEWAY_API_KEY: 'k' })).toBe('gateway')
    expect(aiProvider({ OPENROUTER_API_KEY: 'k' })).toBe('openrouter')
    expect(aiProvider({ AI_GATEWAY_API_KEY: 'a', OPENROUTER_API_KEY: 'b' })).toBe('gateway')
  })

  it('honours AI_PROVIDER, but never without its key', () => {
    expect(
      aiProvider({ AI_PROVIDER: 'openrouter', AI_GATEWAY_API_KEY: 'a', OPENROUTER_API_KEY: 'b' }),
    ).toBe('openrouter')
    expect(aiProvider({ AI_PROVIDER: 'openrouter', AI_GATEWAY_API_KEY: 'a' })).toBeNull()
    expect(aiProvider({ AI_PROVIDER: 'off', AI_GATEWAY_API_KEY: 'a' })).toBeNull()
  })

  it('treats a blank value from compose as unset', () => {
    expect(aiProvider({ AI_PROVIDER: '', AI_GATEWAY_API_KEY: '', OPENROUTER_API_KEY: 'k' })).toBe(
      'openrouter',
    )
  })

  it('runs the fake model in development only', () => {
    expect(aiProvider({ AI_PROVIDER: 'mock' })).toBe('mock')
    expect(aiProvider({ AI_PROVIDER: 'mock', NODE_ENV: 'production' })).toBeNull()
    expect(aiModel('productWriter', { AI_PROVIDER: 'mock' })).not.toBeNull()
  })

  it('builds a real provider model without calling it', () => {
    const model = aiModel('assistant', { AI_GATEWAY_API_KEY: 'k' })
    expect(model).not.toBeNull()
  })
})

describe('models and plans from the environment', () => {
  it('uses the feature default unless AI_MODEL overrides it', () => {
    expect(modelIdFor('assistant', {})).toBe('anthropic/claude-haiku-4.5')
    expect(modelIdFor('assistant', { AI_MODEL: 'openai/gpt-4.1-mini' })).toBe('openai/gpt-4.1-mini')
  })

  it('routes long writing to the strong tier only at "Best" quality', () => {
    expect(tierFor('assistant', 'best')).toBe('fast')
    expect(tierFor('productWriter')).toBe('fast')
    expect(tierFor('bulkWriter', 'best')).toBe('strong')
    expect(modelIdForTier('strong', {})).toBe('anthropic/claude-sonnet-4.5')
    expect(modelIdForTier('strong', { AI_MODEL: 'x/fast', AI_MODEL_STRONG: 'x/strong' })).toBe(
      'x/strong',
    )
    expect(modelIdFor('bulkWriter', { AI_MODEL: 'x/fast' }, 'fast')).toBe('x/fast')
    expect(TIER_CALL_WEIGHT.strong).toBeGreaterThan(TIER_CALL_WEIGHT.fast)
  })

  it('keeps a store that turned "Ask your store" off with the assistant off', () => {
    expect(parseFeatureToggles({ askStore: false })).toEqual({
      productWriter: true,
      assistant: false,
      bulkWriter: true,
    })
    expect(parseFeatureToggles({ askStore: false, assistant: true }).assistant).toBe(true)
    expect(parseFeatureToggles('junk')).toEqual({
      productWriter: true,
      assistant: true,
      bulkWriter: true,
    })
  })

  it('reads unlimited stores by slug, any case', () => {
    expect(isUnlimitedStore('waimers', { AI_UNLIMITED_STORES: 'Waimers, other' })).toBe(true)
    expect(isUnlimitedStore('someone', { AI_UNLIMITED_STORES: 'waimers' })).toBe(false)
    expect(isUnlimitedStore('waimers', {})).toBe(false)
  })
})
