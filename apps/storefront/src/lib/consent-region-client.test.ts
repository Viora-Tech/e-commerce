import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchRegion, REGION_KEY } from './consent-region-client'

/*
 * A page a shared cache may keep learns the visitor's region in the browser. When that check
 * fails or is slow, the visitor is treated as not needing the banner (tracking runs), and the
 * guess is not saved for the tab.
 */
let store: Map<string, string>

beforeEach(() => {
  store = new Map()
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    },
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const answer = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status }))

describe('fetchRegion', () => {
  it('uses and saves the server answer', async () => {
    vi.stubGlobal('fetch', answer({ region: 'ask' }))
    expect(await fetchRegion()).toBe('ask')
    expect(store.get(REGION_KEY)).toBe('ask')
  })

  it('a region already learned in this tab skips the request', async () => {
    store.set(REGION_KEY, 'ask')
    const f = answer({ region: 'open' })
    vi.stubGlobal('fetch', f)
    expect(await fetchRegion()).toBe('ask')
    expect(f).not.toHaveBeenCalled()
  })

  it('a network failure means no banner, not saved', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('offline')
      }),
    )
    expect(await fetchRegion()).toBe('open')
    expect(store.has(REGION_KEY)).toBe(false)
  })

  it('a server error or an odd answer means no banner, not saved', async () => {
    vi.stubGlobal('fetch', answer({ region: 'ask' }, 500))
    expect(await fetchRegion()).toBe('open')
    vi.stubGlobal('fetch', answer({ region: 'maybe' }))
    expect(await fetchRegion()).toBe('open')
    expect(store.has(REGION_KEY)).toBe(false)
  })

  it('a check that takes too long means no banner', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('aborted', 'AbortError')),
            )
          }),
      ),
    )
    const pending = fetchRegion()
    await vi.advanceTimersByTimeAsync(3000)
    expect(await pending).toBe('open')
    expect(store.has(REGION_KEY)).toBe(false)
  })
})
