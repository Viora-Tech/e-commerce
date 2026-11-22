/** SOURCE OF TRUTH: IndexNow rules tests — the key, its path, which stores ping, the batched body and the POST */
import { describe, expect, it, vi } from 'vitest'
import {
  INDEXNOW_ENDPOINT,
  indexNowHost,
  indexNowKeyFromPath,
  indexNowPath,
  indexNowPayloads,
  newIndexNowKey,
  readIndexNowKey,
  submitIndexNow,
} from './indexnow'

const KEY = '0123456789abcdef0123456789abcdef'
const live = { hostname: 'www.Waimers.in', kind: 'custom', status: 'active', sslStatus: 'active' }

describe('key', () => {
  it('makes 32 hex characters, different each time', () => {
    const a = newIndexNowKey()
    expect(a).toMatch(/^[a-f0-9]{32}$/)
    expect(newIndexNowKey()).not.toBe(a)
  })

  it('reads the key file path and nothing else', () => {
    expect(indexNowKeyFromPath(`/${KEY}.txt`)).toBe(KEY)
    expect(indexNowKeyFromPath('/robots.txt')).toBeNull()
    expect(indexNowKeyFromPath(`/pages/${KEY}.txt`)).toBeNull()
    expect(indexNowKeyFromPath(`/${KEY.toUpperCase()}.txt`)).toBeNull()
  })

  it('reads a stored key only when it is well formed', () => {
    expect(readIndexNowKey({ indexNow: { key: KEY } })).toBe(KEY)
    expect(readIndexNowKey({ indexNow: { key: 'short' } })).toBeNull()
    expect(readIndexNowKey({ seo: {} })).toBeNull()
    expect(readIndexNowKey(null)).toBeNull()
  })
})

describe('indexNowHost', () => {
  it('pings a live custom domain that search engines may index', () => {
    expect(indexNowHost({ domain: live, indexable: true })).toBe('www.waimers.in')
  })

  it('never pings a platform address, a domain still being set up, a locked store or localhost', () => {
    expect(indexNowHost({ domain: { ...live, kind: 'platform' }, indexable: true })).toBeNull()
    expect(indexNowHost({ domain: { ...live, status: 'pending' }, indexable: true })).toBeNull()
    expect(indexNowHost({ domain: { ...live, sslStatus: 'issuing' }, indexable: true })).toBeNull()
    expect(indexNowHost({ domain: live, indexable: false })).toBeNull()
    expect(indexNowHost({ domain: null, indexable: true })).toBeNull()
    expect(
      indexNowHost({ domain: { ...live, hostname: 'shop.localhost' }, indexable: true }),
    ).toBeNull()
  })
})

describe('indexNowPayloads', () => {
  it('sends absolute URLs once each, with the key and its location', () => {
    const [body, ...rest] = indexNowPayloads('www.waimers.in', KEY, [
      indexNowPath('product', 'glass-pad'),
      '/products/glass-pad',
      indexNowPath('collection', 'mice'),
      indexNowPath('page', 'about us'),
      'https://evil.example/x',
      '//evil.example/x',
    ])
    expect(rest).toEqual([])
    expect(body).toEqual({
      host: 'www.waimers.in',
      key: KEY,
      keyLocation: `https://www.waimers.in/${KEY}.txt`,
      urlList: [
        'https://www.waimers.in/products/glass-pad',
        'https://www.waimers.in/collections/mice',
        'https://www.waimers.in/pages/about%20us',
      ],
    })
  })

  it('splits a big change into bodies of at most the limit, and sends nothing for no change', () => {
    const paths = Array.from({ length: 5 }, (_, i) => `/products/p${i}`)
    const bodies = indexNowPayloads('shop.in', KEY, paths, 2)
    expect(bodies.map((b) => b.urlList.length)).toEqual([2, 2, 1])
    expect(indexNowPayloads('shop.in', KEY, [])).toEqual([])
  })
})

describe('submitIndexNow', () => {
  it('POSTs each body as JSON to the IndexNow endpoint', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 202 }))
    const bodies = indexNowPayloads('shop.in', KEY, ['/products/a', '/products/b'], 1)
    const results = await submitIndexNow(bodies, fetchMock as unknown as typeof fetch)
    expect(results).toEqual([
      { ok: true, status: 202, urls: 1 },
      { ok: true, status: 202, urls: 1 },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(INDEXNOW_ENDPOINT)
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual(bodies[0])
  })

  it('reports a refusal or a network error once, without throwing or retrying', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('bad key', { status: 403 }))
      .mockRejectedValueOnce(new Error('offline'))
    const bodies = indexNowPayloads('shop.in', KEY, ['/products/a', '/products/b'], 1)
    const results = await submitIndexNow(bodies, fetchMock as unknown as typeof fetch)
    expect(results).toEqual([
      { ok: false, status: 403, urls: 1 },
      { ok: false, status: null, urls: 1 },
    ])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
