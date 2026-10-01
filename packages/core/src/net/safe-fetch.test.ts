/** SOURCE OF TRUTH: SSRF guard tests — WHAT schemes, private/metadata/mapped addresses, redirect re-checks and the streaming byte cap / WHY an untrusted URL must never reach our own network; fetch and DNS are fakes, nothing leaves the process */
import { describe, expect, it } from 'vitest'
import { readCapped, safeFetch } from './safe-fetch'

const PUBLIC = '93.184.216.34'

/** DNS: `name → addresses`, anything else is a public host. */
const lookup =
  (table: Record<string, string[]> = {}) =>
  async (host: string) =>
    table[host] ?? [PUBLIC]

/** Routes by URL; records every URL actually fetched. */
function fakeFetch(routes: Record<string, () => Response>) {
  const calls: string[] = []
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    calls.push(url)
    expect(init?.redirect).toBe('manual')
    const route = routes[url]
    if (!route) throw new Error(`unexpected fetch ${url}`)
    return route()
  }) as typeof fetch
  return { fn, calls }
}

const redirect = (to: string) => () =>
  new Response(null, { status: 302, headers: { location: to } })

describe('safeFetch', () => {
  it('refuses non-http schemes', async () => {
    const f = fakeFetch({})
    await expect(
      safeFetch('file:///etc/passwd', { fetch: f.fn, lookup: lookup(), allowHttp: true }),
    ).rejects.toThrow(/file: URLs are not allowed/)
    await expect(
      safeFetch('http://example.com/a.png', { fetch: f.fn, lookup: lookup() }),
    ).rejects.toThrow(/http: URLs are not allowed/)
    expect(f.calls).toEqual([])
  })

  it.each([
    'http://169.254.169.254/latest/meta-data/',
    'http://127.0.0.1/',
    'http://100.64.0.1/',
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://[::ffff:127.0.0.1]/',
    'http://[::ffff:a9fe:a9fe]/',
    'http://[fe80::1]/',
    'http://[fd00::1]/',
    'http://[64:ff9b::a9fe:a9fe]/',
    'http://0x7f.1/',
    'http://255.255.255.255/',
  ])('refuses the IP literal %s', async (url) => {
    const f = fakeFetch({})
    await expect(
      safeFetch(url, { fetch: f.fn, lookup: lookup(), allowHttp: true }),
    ).rejects.toThrow(/not a public address/)
    expect(f.calls).toEqual([])
  })

  it('refuses a hostname when any address it resolves to is private', async () => {
    const f = fakeFetch({})
    const dns = lookup({ 'internal.example': ['10.0.0.1'], 'mixed.example': [PUBLIC, '::1'] })
    await expect(
      safeFetch('https://internal.example/a.png', { fetch: f.fn, lookup: dns }),
    ).rejects.toThrow(/not a public address/)
    await expect(
      safeFetch('https://mixed.example/a.png', { fetch: f.fn, lookup: dns }),
    ).rejects.toThrow(/not a public address/)
    expect(f.calls).toEqual([])
  })

  it('refuses a redirect to cloud metadata without fetching it', async () => {
    const f = fakeFetch({ 'https://cdn.example/a.png': redirect('http://169.254.169.254/latest/') })
    await expect(
      safeFetch('https://cdn.example/a.png', { fetch: f.fn, lookup: lookup(), allowHttp: true }),
    ).rejects.toThrow(/not a public address/)
    expect(f.calls).toEqual(['https://cdn.example/a.png'])
  })

  it('follows a redirect to another public host, relative Locations included', async () => {
    const f = fakeFetch({
      'https://a.example/x.png': redirect('https://b.example/y.png'),
      'https://b.example/y.png': redirect('/z.png'),
      'https://b.example/z.png': () => new Response('ok'),
    })
    const res = await safeFetch('https://a.example/x.png', { fetch: f.fn, lookup: lookup() })
    expect(await res.text()).toBe('ok')
    expect(f.calls).toHaveLength(3)
  })

  it('stops after too many redirects', async () => {
    const f = fakeFetch({ 'https://loop.example/': redirect('https://loop.example/') })
    await expect(
      safeFetch('https://loop.example/', { fetch: f.fn, lookup: lookup(), maxRedirects: 3 }),
    ).rejects.toThrow(/too many redirects/)
    expect(f.calls).toHaveLength(4)
  })

  it('returns a normal small response', async () => {
    const f = fakeFetch({
      'https://cdn.example/a.png': () =>
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }),
    })
    const res = await safeFetch('https://cdn.example/a.png', { fetch: f.fn, lookup: lookup() })
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(await readCapped(res, 10)).toEqual(new Uint8Array([1, 2, 3]))
  })
})

describe('readCapped', () => {
  it('abandons a chunked body over the cap, with no content-length', async () => {
    let pulled = 0
    let cancelled = false
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled++
        controller.enqueue(new Uint8Array(1024))
      },
      cancel() {
        cancelled = true
      },
    })
    const res = new Response(body)
    expect(res.headers.get('content-length')).toBeNull()
    expect(await readCapped(res, 4096)).toBeNull()
    expect(cancelled).toBe(true)
    expect(pulled).toBeLessThan(10)
  })

  it('refuses up front when content-length is over the cap', async () => {
    const res = new Response('x'.repeat(20), { headers: { 'content-length': '20' } })
    expect(await readCapped(res, 10)).toBeNull()
  })
})
