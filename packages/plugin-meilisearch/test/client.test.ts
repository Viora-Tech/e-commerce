import { describe, expect, it } from 'vitest'
import { MeiliError, meiliClient, parseTrustedOrigins } from '../src/client'

type Call = { url: string; init: RequestInit }

/** A fake Meilisearch: answers by method + pathname, records every call. */
function fakeMeili(routes: Record<string, (url: URL, init: RequestInit) => Response>) {
  const calls: Call[] = []
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push({ url: url.href, init: init ?? {} })
    const route = routes[`${init?.method ?? 'GET'} ${url.pathname}`]
    return route ? route(url, init ?? {}) : new Response('{}', { status: 404 })
  }) as typeof fetch
  return { fn, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Every host resolves to a public address. */
const lookup = async () => ['93.184.216.34']

const client = (fn: typeof fetch, host = 'https://search.example') =>
  meiliClient({ host, apiKey: 'key-1', fetch: fn, lookup })

describe('meiliClient', () => {
  it('sends the key as a bearer token and reads the version', async () => {
    const meili = fakeMeili({ 'GET /version': () => json({ pkgVersion: '1.24.0' }) })
    expect(await client(meili.fn).version()).toBe('1.24.0')
    const headers = meili.calls[0]?.init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer key-1')
  })

  it('searches for ids only and returns them in order', async () => {
    const meili = fakeMeili({
      'POST /indexes/products_s1/search': () => json({ hits: [{ id: 'b' }, { id: 'a' }, {}] }),
    })
    expect(await client(meili.fn).searchIds('products_s1', { query: 'tshrit', limit: 20 })).toEqual(
      ['b', 'a'],
    )
    expect(JSON.parse(String(meili.calls[0]?.init.body))).toEqual({
      q: 'tshrit',
      limit: 20,
      attributesToRetrieve: ['id'],
    })
  })

  it('creates a search-only key for the store index', async () => {
    const meili = fakeMeili({ 'POST /keys': () => json({ key: 'sk', uid: 'u1' }, 201) })
    const key = await client(meili.fn).createSearchKey({ name: 'n', indexes: ['products_s1'] })
    expect(key).toEqual({ key: 'sk', uid: 'u1' })
    expect(JSON.parse(String(meili.calls[0]?.init.body))).toMatchObject({
      actions: ['search'],
      indexes: ['products_s1'],
      expiresAt: null,
    })
  })

  it('posts documents and deletes by id', async () => {
    const meili = fakeMeili({
      'POST /indexes/i/documents': () => json({ taskUid: 7 }, 202),
      'POST /indexes/i/documents/delete-batch': () => json({ taskUid: 8 }, 202),
    })
    const c = client(meili.fn)
    expect(await c.addDocuments('i', [])).toEqual({ taskUid: 7 })
    expect(meili.calls[0]?.url).toContain('primaryKey=id')
    expect(await c.deleteDocuments('i', ['x'])).toEqual({ taskUid: 8 })
  })

  it('names failures in plain words', async () => {
    const meili = fakeMeili({
      'GET /version': () => json({ message: 'bad key' }, 403),
      'POST /indexes/i/search': () => json({ message: 'Attribute `x` is not filterable.' }, 400),
    })
    await expect(client(meili.fn).version()).rejects.toMatchObject({ code: 'unauthorized' })
    const err = await client(meili.fn)
      .searchIds('i', { query: 'q', limit: 1 })
      .catch((e: unknown) => e)
    expect(err).toBeInstanceOf(MeiliError)
    expect((err as MeiliError).message).toContain('not filterable')
  })

  it('treats a network failure as unreachable', async () => {
    const fn = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch
    await expect(client(fn).version()).rejects.toMatchObject({ code: 'unreachable' })
  })

  it('refuses a private address unless the origin is trusted', async () => {
    const meili = fakeMeili({ 'GET /version': () => json({ pkgVersion: '1.24.0' }) })
    await expect(client(meili.fn, 'http://meilisearch:7700').version()).rejects.toMatchObject({
      code: 'unreachable',
    })
    const trusted = meiliClient({
      host: 'http://meilisearch:7700',
      apiKey: 'k',
      fetch: meili.fn,
      trustedOrigins: ['http://meilisearch:7700'],
    })
    expect(await trusted.version()).toBe('1.24.0')
  })

  it('waits for a task and reports a failed one with Meilisearch’s words', async () => {
    let polls = 0
    const meili = fakeMeili({
      'GET /tasks/1': () => json({ status: ++polls < 3 ? 'processing' : 'succeeded' }),
      'GET /tasks/2': () => json({ status: 'failed', error: { message: 'Index already exists.' } }),
    })
    const c = client(meili.fn)
    const sleep = async () => {}
    await c.waitForTask({ taskUid: 1 }, { sleep })
    expect(polls).toBe(3)
    await expect(c.waitForTask({ taskUid: 2 }, { sleep })).rejects.toMatchObject({
      code: 'task-failed',
      message: expect.stringContaining('Index already exists.'),
    })
  })
})

describe('parseTrustedOrigins', () => {
  it('keeps valid origins only', () => {
    expect(parseTrustedOrigins('http://meilisearch:7700/, nope ,https://s.example/x')).toEqual([
      'http://meilisearch:7700',
      'https://s.example',
    ])
    expect(parseTrustedOrigins(undefined)).toEqual([])
  })
})
