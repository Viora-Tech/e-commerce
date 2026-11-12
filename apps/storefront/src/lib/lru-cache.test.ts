import { describe, expect, it } from 'vitest'
import { approxSize, LruCache } from './lru-cache'

function cache(maxSize: number) {
  let now = 0
  return { c: new LruCache<string>({ maxSize, now: () => now }), tick: (ms: number) => (now += ms) }
}

describe('LruCache', () => {
  it('returns what was stored until it expires', () => {
    const { c, tick } = cache(100)
    c.set('a', 'A', 10, 1_000)
    expect(c.get('a')).toBe('A')
    tick(999)
    expect(c.get('a')).toBe('A')
    tick(1)
    expect(c.get('a')).toBeUndefined()
    expect(c.size).toBe(0)
  })

  it('drops the least recently used entries over budget', () => {
    const { c } = cache(100)
    c.set('a', 'A', 25, 1_000)
    c.set('b', 'B', 25, 1_000)
    c.set('c', 'C', 25, 1_000)
    c.get('a')
    c.set('d', 'D', 25, 1_000)
    c.set('e', 'E', 25, 1_000)
    expect(c.get('b')).toBeUndefined()
    expect(c.get('a')).toBe('A')
    expect(c.size).toBe(100)
  })

  it('keeps nothing too big, nothing with no lifetime, and nothing when off', () => {
    const { c } = cache(100)
    c.set('big', 'X', 26, 1_000)
    c.set('zero', 'X', 1, 0)
    expect(c.count).toBe(0)
    const off = cache(0).c
    off.set('a', 'A', 1, 1_000)
    expect(off.get('a')).toBeUndefined()
  })

  it('replacing a key replaces its size', () => {
    const { c } = cache(100)
    c.set('a', 'A', 20, 1_000)
    c.set('a', 'AA', 10, 1_000)
    expect(c.size).toBe(10)
    expect(c.get('a')).toBe('AA')
    c.clear()
    expect(c.count).toBe(0)
  })

  it('deleteWhere drops the picked entries and the expired ones', () => {
    const { c, tick } = cache(100)
    c.set('s1|a', 'A', 10, 1_000)
    c.set('s2|b', 'B', 10, 1_000)
    c.set('s3|c', 'C', 10, 10)
    tick(20)
    c.deleteWhere((key) => key.startsWith('s1|'))
    expect(c.count).toBe(1)
    expect(c.size).toBe(10)
    expect(c.get('s2|b')).toBe('B')
  })
})

describe('approxSize', () => {
  it('grows with the data', () => {
    const small = approxSize({ a: 'x' })
    const big = approxSize({ a: 'x'.repeat(10_000), list: [1, 2, 3], m: new Map([['k', 'v']]) })
    expect(big).toBeGreaterThan(small + 10_000)
    expect(approxSize(null)).toBeGreaterThan(0)
    expect(approxSize(new Date())).toBeGreaterThan(0)
  })

  it('stops on a cycle instead of looping', () => {
    const a: Record<string, unknown> = {}
    a.self = a
    expect(approxSize(a)).toBeGreaterThan(0)
  })
})
