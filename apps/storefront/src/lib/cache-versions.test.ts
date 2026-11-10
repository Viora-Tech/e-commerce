import { describe, expect, it } from 'vitest'
import { StoreVersions } from './cache-versions'

const A = '01a0de8f-0350-7522-8375-547613dcae7f'
const B = '75e01395-6ec0-b430-6e53-5cff76fa525d'

function versions(start = 1_000) {
  let now = start
  const v = new StoreVersions({ now: () => now, softDelayMs: 60_000 })
  return { v, tick: (ms: number) => (now += ms), at: () => now }
}

describe('StoreVersions', () => {
  it('caches nothing until the listener is connected, nor after it drops', () => {
    const { v } = versions()
    expect(v.stamp(A)).toBeNull()
    v.connected()
    expect(v.stamp(A)).toBe('1.0')
    v.disconnected()
    expect(v.stamp(A)).toBeNull()
  })

  it('a reconnect starts a new epoch, so nothing from before the gap is reused', () => {
    const { v } = versions()
    v.connected()
    v.notify(A, false)
    expect(v.stamp(A)).toBe('1.1')
    v.disconnected()
    v.connected()
    expect(v.stamp(A)).toBe('2.0')
  })

  it('a hard notification bumps only that store, at once', () => {
    const { v } = versions()
    v.connected()
    const a = v.stamp(A)
    const b = v.stamp(B)
    v.notify(A, false)
    expect(v.stamp(A)).not.toBe(a)
    expect(v.stamp(B)).toBe(b)
  })

  it('soft notifications wait for the batch to go quiet, then apply once', () => {
    const { v, tick } = versions()
    v.connected()
    const before = v.stamp(A)
    v.notify(A, true)
    tick(30_000)
    v.notify(A, true)
    tick(30_000)
    // 60 s after the first, but only 30 s after the last: still waiting.
    expect(v.stamp(A)).toBe(before)
    tick(30_000)
    const after = v.stamp(A)
    expect(after).not.toBe(before)
    tick(120_000)
    expect(v.stamp(A)).toBe(after)
  })

  it('a long stream of soft notifications still applies every ten minutes (#1471)', () => {
    const { v, tick } = versions()
    v.connected()
    const before = v.stamp(A)
    // An image finishing every 40 s for 16 minutes, like a staff bulk upload.
    let bumps = 0
    let last = before
    for (let t = 0; t < 16 * 60_000; t += 40_000) {
      v.notify(A, true)
      tick(40_000)
      const now = v.stamp(A)
      if (now !== last) bumps++
      last = now
    }
    expect(bumps).toBe(1)
    tick(60_000)
    expect(v.stamp(A)).not.toBe(last)
  })

  it('a hard notification covers a pending soft one', () => {
    const { v, tick } = versions()
    v.connected()
    v.notify(A, true)
    v.notify(A, false)
    const hard = v.stamp(A)
    tick(60_000)
    expect(v.stamp(A)).toBe(hard)
  })

  it('a scheduled change ends the version when it passes', () => {
    const { v, tick, at } = versions()
    v.connected()
    const stamp = v.stamp(A) as string
    expect(v.needsBoundary(A)).toBe(true)
    v.setBoundary(A, stamp, at() + 5_000)
    expect(v.needsBoundary(A)).toBe(false)
    tick(4_999)
    expect(v.stamp(A)).toBe(stamp)
    tick(1)
    expect(v.stamp(A)).not.toBe(stamp)
    expect(v.needsBoundary(A)).toBe(true)
  })

  it('ignores a boundary looked up before a write', () => {
    const { v, at } = versions()
    v.connected()
    const stamp = v.stamp(A) as string
    v.notify(A, false)
    v.setBoundary(A, stamp, at() + 5_000)
    expect(v.needsBoundary(A)).toBe(true)
  })

  it('no scheduled change: the version stays', () => {
    const { v, tick } = versions()
    v.connected()
    const stamp = v.stamp(A) as string
    v.setBoundary(A, stamp, null)
    tick(10 * 86_400_000)
    expect(v.stamp(A)).toBe(stamp)
  })
})
