import type { PutInput, PutStreamInput, StorageProvider } from '@commerce/storage'
import { describe, expect, it } from 'vitest'
import { createMediaHost, type MediaHostOptions } from '../src/media'
import type { InStore } from '../src/runtime'

/**
 * No database: the transaction answers "no mapping yet" and swallows writes, so
 * these cover only the download guard in front of `provider.put`.
 */
const tx = {
  select: () => ({ from: () => ({ where: async () => [] }) }),
  insert: () => ({ values: () => ({ onConflictDoUpdate: async () => {} }) }),
}
const inStore = ((fn: (t: unknown) => unknown) => fn(tx)) as unknown as InStore

type Stored = { key: string; contentType: string; bytes: number; streamed: boolean }

function host(
  routes: Record<string, () => Response | Promise<Response>>,
  extra: Partial<MediaHostOptions> = {},
) {
  const puts: Stored[] = []
  const fetched: string[] = []
  const settled: boolean[] = []
  const provider = {
    id: 'memory',
    put: async (o: PutInput) => {
      puts.push({
        key: o.key,
        contentType: o.contentType,
        bytes: o.body.byteLength,
        streamed: false,
      })
    },
    putStream: async (o: PutStreamInput) => {
      const body = new Uint8Array(await new Response(o.body).arrayBuffer())
      puts.push({ key: o.key, contentType: o.contentType, bytes: body.byteLength, streamed: true })
    },
    publicUrl: (key: string) => `https://media.test/${key}`,
  } as unknown as StorageProvider
  const media = createMediaHost({
    storeId: '01923456-7890-7abc-8def-0123456789ab',
    inStore,
    storage: async () => provider,
    lookup: async () => ['93.184.216.34'],
    fetch: (async (input: string | URL | Request) => {
      const url = String(input)
      fetched.push(url)
      const route = routes[url]
      if (!route) throw new Error(`unexpected fetch ${url}`)
      return route()
    }) as typeof fetch,
    sleep: async () => {},
    onSettled: (ok) => settled.push(ok),
    ...extra,
  })
  return { media, puts, fetched, settled }
}

/** A body that sends one chunk and then nothing, ever. */
const stalled = (first: Uint8Array) => {
  let sent = false
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent) return new Promise(() => {})
      sent = true
      controller.enqueue(first)
    },
  })
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

describe('imported media downloads', () => {
  it('never stores a source that redirects to cloud metadata', async () => {
    const h = host({
      'https://evil.example/cat.mp4': () =>
        new Response(null, {
          status: 302,
          headers: { location: 'http://169.254.169.254/latest/meta-data/iam/' },
        }),
      'http://169.254.169.254/latest/meta-data/iam/': () =>
        new Response('secret-role', { headers: { 'content-type': 'text/plain' } }),
    })
    await expect(h.media.host('https://evil.example/cat.mp4', '')).rejects.toThrow(
      /not a public address/,
    )
    expect(h.fetched).toEqual(['https://evil.example/cat.mp4'])
    expect(h.puts).toEqual([])
  })

  it('never trusts the URL extension: text named .mp4 is refused', async () => {
    const h = host({
      'https://evil.example/cat.mp4': () =>
        new Response('ami-id\ninstance-id', { headers: { 'content-type': 'text/plain' } }),
    })
    await expect(h.media.host('https://evil.example/cat.mp4', '')).rejects.toThrow(
      /text\/plain is not supported/,
    )
    expect(h.puts).toEqual([])
  })

  it('hosts a CDN image, sniffing it when the CDN sends no useful type', async () => {
    const h = host({
      'https://cdn.shopify.com/s/files/a.png': () =>
        new Response(PNG, { headers: { 'content-type': 'image/png' } }),
      'https://cdn.shopify.com/s/files/b': () =>
        new Response(PNG, { headers: { 'content-type': 'application/octet-stream' } }),
    })
    await h.media.host('https://cdn.shopify.com/s/files/a.png?v=1', 'A')
    await h.media.host('https://cdn.shopify.com/s/files/b', 'B')
    expect(h.puts.map((p) => p.contentType)).toEqual(['image/png', 'image/png'])
  })
})

describe('copies that misbehave', () => {
  const MP4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 1, 2, 3])

  it('never trusts content-length on an encoded response: the bytes stored are the bytes received', async () => {
    // fetch decompresses gzip/br and leaves the compressed length in content-length.
    const encoded = (body: Uint8Array<ArrayBuffer>, type: string) => () =>
      new Response(body, {
        headers: { 'content-type': type, 'content-encoding': 'gzip', 'content-length': '5' },
      })
    const h = host({
      'https://cdn.shopify.com/a.png': encoded(PNG, 'image/png'),
      'https://cdn.shopify.com/v.mp4': encoded(MP4, 'video/mp4'),
    })
    await h.media.host('https://cdn.shopify.com/a.png', null)
    await h.media.host('https://cdn.shopify.com/v.mp4', null)
    expect(h.puts).toEqual([
      expect.objectContaining({ contentType: 'image/png', bytes: PNG.byteLength, streamed: false }),
      expect.objectContaining({ contentType: 'video/mp4', bytes: MP4.byteLength, streamed: true }),
    ])
  })

  it('a download that stops sending times out, retries, and frees its slot for the next copy', async () => {
    const h = host(
      {
        'https://cdn.shopify.com/stuck.png': () =>
          new Response(stalled(PNG.subarray(0, 4)), { headers: { 'content-type': 'image/png' } }),
        'https://cdn.shopify.com/fine.png': () =>
          new Response(PNG, { headers: { 'content-type': 'image/png' } }),
      },
      { maxInFlight: 1, timeoutMs: 5000, idleTimeoutMs: 40 },
    )
    const [stuck, fine] = await Promise.allSettled([
      h.media.host('https://cdn.shopify.com/stuck.png', null),
      h.media.host('https://cdn.shopify.com/fine.png', null),
    ])
    expect(stuck.status).toBe('rejected')
    expect((stuck as PromiseRejectedResult).reason.message).toMatch(
      /timed out: no data for 0\.04 s \(tried 3 times\)/,
    )
    expect(fine.status).toBe('fulfilled')
    expect(h.fetched.filter((u) => u.includes('stuck'))).toHaveLength(3)
    expect(h.puts.map((p) => p.key)).toHaveLength(1)
    expect(h.settled.sort()).toEqual([false, true])
  })

  it('a source that never answers at all times out on the overall deadline', async () => {
    const h = host(
      { 'https://cdn.shopify.com/silent.png': () => new Promise<Response>(() => {}) },
      { timeoutMs: 50, retries: 0 },
    )
    await expect(h.media.host('https://cdn.shopify.com/silent.png', null)).rejects.toThrow(
      /timed out after 0\.05 s/,
    )
  })

  it('retries a passing server error, never a refusal', async () => {
    let calls = 0
    const h = host({
      'https://cdn.shopify.com/flaky.png': () =>
        ++calls === 1
          ? new Response('busy', { status: 503 })
          : new Response(PNG, { headers: { 'content-type': 'image/png' } }),
      'https://cdn.shopify.com/gone.png': () => new Response('nope', { status: 404 }),
    })
    await expect(h.media.host('https://cdn.shopify.com/flaky.png', null)).resolves.toBeTruthy()
    expect(calls).toBe(2)
    await expect(h.media.host('https://cdn.shopify.com/gone.png', null)).rejects.toThrow(
      /download failed \(404\)$/,
    )
    expect(h.fetched.filter((u) => u.includes('gone'))).toHaveLength(1)
  })

  it('stops every copy when the run is stopped', async () => {
    const stop = new AbortController()
    const h = host(
      {
        'https://cdn.shopify.com/slow.png': () =>
          new Response(stalled(PNG.subarray(0, 4)), { headers: { 'content-type': 'image/png' } }),
      },
      { signal: stop.signal, idleTimeoutMs: 60_000 },
    )
    const copying = h.media.host('https://cdn.shopify.com/slow.png', null)
    setTimeout(() => stop.abort(new Error('the import was stopped')), 20)
    await expect(copying).rejects.toThrow(/stopped/)
    expect(h.fetched).toHaveLength(1)
  })
})
