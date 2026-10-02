import { describe, expect, it } from 'vitest'
import { aiModel, aiProvider, isUnlimitedStore, modelIdFor } from '../src/provider'

describe('aiProvider', () => {
  it('is off with no key', () => {
    expect(aiProvider({})).toBeNull()
    expect(aiModel('askStore', {})).toBeNull()
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
    const model = aiModel('askStore', { AI_GATEWAY_API_KEY: 'k' })
    expect(model).not.toBeNull()
  })
})

describe('models and plans from the environment', () => {
  it('uses the feature default unless AI_MODEL overrides it', () => {
    expect(modelIdFor('askStore', {})).toBe('anthropic/claude-haiku-4.5')
    expect(modelIdFor('askStore', { AI_MODEL: 'openai/gpt-4.1-mini' })).toBe('openai/gpt-4.1-mini')
  })

  it('reads unlimited stores by slug, any case', () => {
    expect(isUnlimitedStore('waimers', { AI_UNLIMITED_STORES: 'Waimers, other' })).toBe(true)
    expect(isUnlimitedStore('someone', { AI_UNLIMITED_STORES: 'waimers' })).toBe(false)
    expect(isUnlimitedStore('waimers', {})).toBe(false)
  })
})
