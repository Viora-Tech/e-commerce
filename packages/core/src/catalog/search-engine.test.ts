/** SOURCE OF TRUTH: product search engine hook tests — WHAT: engineProductIds' fallbacks (no engine, error, null, budget) and id clean-up / WHY: a broken or slow engine must never break storefront search */
import type { StoreTx } from '@commerce/db'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  engineProductIds,
  type ProductSearchEngine,
  productSearchEngine,
  setProductSearchEngine,
} from './search-engine'

/** A transaction whose savepoint just runs the callback on itself. */
const tx = {
  transaction: <T>(fn: (sp: StoreTx) => Promise<T>) => fn(tx as unknown as StoreTx),
} as unknown as StoreTx

const A = '0b0f6c1e-1d2a-4b8e-9c3f-5a6b7c8d9e0f'
const B = '1c1f6c1e-1d2a-4b8e-9c3f-5a6b7c8d9e0f'

afterEach(() => setProductSearchEngine(null))

describe('engineProductIds', () => {
  it('is null with no engine, so SQL searches', async () => {
    expect(await engineProductIds(tx, 's', 'tee')).toBeNull()
  })

  it('passes the store, trimmed query and limit; keeps uuids once, in order', async () => {
    let seen: Parameters<ProductSearchEngine>[0] | null = null
    setProductSearchEngine(async (input) => {
      seen = input
      return [B, 'not-a-uuid', A, B]
    })
    expect(await engineProductIds(tx, 's1', '  tee ', 20)).toEqual([B, A])
    expect(seen).toMatchObject({ storeId: 's1', query: 'tee', limit: 20 })
  })

  it('falls back on an error, on null, on no match and on an empty query', async () => {
    setProductSearchEngine(async () => {
      throw new Error('down')
    })
    expect(await engineProductIds(tx, 's', 'tee')).toBeNull()
    setProductSearchEngine(async () => null)
    expect(await engineProductIds(tx, 's', 'tee')).toBeNull()
    setProductSearchEngine(async () => ['not-a-uuid'])
    expect(await engineProductIds(tx, 's', 'tee')).toBeNull()
    setProductSearchEngine(async () => [A])
    expect(await engineProductIds(tx, 's', '   ')).toBeNull()
  })

  it('gives up after the budget and aborts the engine', async () => {
    let aborted = false
    setProductSearchEngine(
      ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            aborted = true
            reject(new Error('aborted'))
          })
        }),
    )
    expect(await engineProductIds(tx, 's', 'tee', 10, 20)).toBeNull()
    expect(aborted).toBe(true)
  })

  it('ignores an answer that came after the budget', async () => {
    setProductSearchEngine(() => new Promise((resolve) => setTimeout(() => resolve([A]), 40)))
    expect(await engineProductIds(tx, 's', 'tee', 10, 10)).toBeNull()
  })
})

describe('the engine registry', () => {
  it('is one per process: another copy of the module sees the same engine', async () => {
    setProductSearchEngine(async () => [A])
    // A second module graph (another Next bundle) loads its own copy of this file.
    vi.resetModules()
    const copy = await import('./search-engine')
    expect(copy.productSearchEngine()).toBe(productSearchEngine())
    expect(await copy.engineProductIds(tx, 's', 'tee')).toEqual([A])
    // And registering from the copy changes what this one uses.
    copy.setProductSearchEngine(null)
    expect(await engineProductIds(tx, 's', 'tee')).toBeNull()
  })
})
