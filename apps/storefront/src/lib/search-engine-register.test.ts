import { productSearchEngine, setProductSearchEngine } from '@commerce/core'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@commerce/plugin-meilisearch/server', () => ({
  meiliEnv: () => ({}),
  meilisearchEngine: () => async () => ['meili'],
}))

afterEach(() => setProductSearchEngine(null))

describe('registerSearchEngine', () => {
  it('registers once per process: a later call (another bundle) keeps the first engine', async () => {
    const { registerSearchEngine } = await import('./search-engine-register')
    registerSearchEngine()
    const first = productSearchEngine()
    expect(first).not.toBeNull()
    vi.resetModules()
    const copy = await import('./search-engine-register')
    copy.registerSearchEngine()
    expect(productSearchEngine()).toBe(first)
  })
})
