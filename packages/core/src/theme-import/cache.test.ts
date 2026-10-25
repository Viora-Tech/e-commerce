/** SOURCE OF TRUTH: Liquid data cache batching tests — products and collection products asked for in one render pass load in one batch, with a per-item fallback */
import { describe, expect, it } from 'vitest'
import { LiquidDataCache } from './cache'
import type { LiquidDataSource, LiquidProductData } from './drops'

const product = (handle: string) => ({ id: handle, handle, title: handle }) as LiquidProductData

/** A source that records every product load; `batch` decides whether it offers `products`. */
function source(batch: boolean) {
  const calls: string[] = []
  const s = {
    product: async (handle: string) => {
      calls.push(`one:${handle}`)
      return handle === 'gone' ? null : product(handle)
    },
    products: batch
      ? async (handles: string[]) => {
          calls.push(`batch:${handles.join(',')}`)
          return new Map(handles.filter((h) => h !== 'gone').map((h) => [h, product(h)]))
        }
      : undefined,
  } as unknown as LiquidDataSource
  return { s, calls }
}

describe('LiquidDataCache products', () => {
  it('loads every product one pass asked for in one batch', async () => {
    const { s, calls } = source(true)
    const cache = new LiquidDataCache(s, [])
    expect(cache.product('a')).toBeNull()
    expect(cache.product('b')).toBeNull()
    expect(cache.product('gone')).toBeNull()
    expect(cache.missing).toBe(true)
    await cache.fill()
    expect(calls).toEqual(['batch:a,b,gone'])
    expect(cache.product('a')?.handle).toBe('a')
    expect(cache.product('gone')).toBeNull()
    expect(cache.missing).toBe(false)
  })

  it('falls back to one load per product without a batch', async () => {
    const { s, calls } = source(false)
    const cache = new LiquidDataCache(s, [])
    cache.product('a')
    cache.product('b')
    await cache.fill()
    expect(calls).toEqual(['one:a', 'one:b'])
    expect(cache.product('b')?.handle).toBe('b')
  })
})

describe('LiquidDataCache collection products', () => {
  it('loads every collection one pass asked for in one batch', async () => {
    const calls: string[] = []
    const s = {
      collectionsProducts: async (handles: string[], limit: number) => {
        calls.push(`${handles.join(',')}@${limit}`)
        return new Map([['mice', [product('m1')]]])
      },
    } as unknown as LiquidDataSource
    const cache = new LiquidDataCache(s, [])
    expect(cache.collectionProducts('mice')).toBeNull()
    expect(cache.collectionProducts('pads')).toBeNull()
    await cache.fill()
    expect(calls).toEqual(['mice,pads@50'])
    expect(cache.collectionProducts('mice')?.map((p) => p.handle)).toEqual(['m1'])
    expect(cache.collectionProducts('pads')).toEqual([])
  })
})
