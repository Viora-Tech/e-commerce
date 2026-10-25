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
  /** Each put takes this long, so copies overlap and `peak` shows how many hold bytes at once. */
  slowPutMs = 0,
) {
  const puts: Stored[] = []
  const fetched: string[] = []
  const settled: boolean[] = []
  const writes = { now: 0, peak: 0 }
  const provider = {
    id: 'memory',
    put: async (o: PutInput) => {
      writes.now++
      writes.peak = Math.max(writes.peak, writes.now)
      if (slowPutMs) await new Promise((r) => setTimeout(r, slowPutMs))
      writes.now--
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
  return { media, puts, fetched, settled, writes }
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

describe('large copies (issue #273)', () => {
  const MB = 1024 * 1024
  const MP4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 1, 2, 3])
  /** `bytes` long, starting with `head` (so it sniffs as that type). */
  const sized = (bytes: number, head = PNG) => {
    const out = new Uint8Array(bytes)
    out.set(head)
    return out
  }
  /** A body sent in 1 MB chunks, made as it is read (the source never holds it whole). */
  const generated = (bytes: number, head: Uint8Array) => {
    let sent = 0
    return new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= bytes) return controller.close()
        const n = Math.min(MB, bytes - sent)
        const chunk = new Uint8Array(n)
        if (sent === 0) chunk.set(head)
        sent += n
        controller.enqueue(chunk)
      },
    })
  }
  const image = (body: Uint8Array<ArrayBuffer>) => () =>
    new Response(body, {
      headers: { 'content-type': 'image/png', 'content-length': String(body.byteLength) },
    })

  it('copies a 30 MB image with one put of its exact length', async () => {
    const h = host({ 'https://cdn.shopify.com/big.png': image(sized(30 * MB)) })
    await expect(h.media.host('https://cdn.shopify.com/big.png', null)).resolves.toBeTruthy()
    expect(h.puts).toEqual([
      expect.objectContaining({ contentType: 'image/png', bytes: 30 * MB, streamed: false }),
    ])
  })

  it('refuses an image over 50 MB, said up front or found while reading', async () => {
    const h = host({
      'https://cdn.shopify.com/said.png': () =>
        new Response(generated(60 * MB, PNG), {
          headers: { 'content-type': 'image/png', 'content-length': String(60 * MB) },
        }),
      'https://cdn.shopify.com/unsaid.png': () =>
        new Response(generated(51 * MB, PNG), {
          headers: { 'content-type': 'image/png', 'content-encoding': 'gzip' },
        }),
    })
    await expect(h.media.host('https://cdn.shopify.com/said.png', null)).rejects.toThrow(
      /larger than 50 MB/,
    )
    await expect(h.media.host('https://cdn.shopify.com/unsaid.png', null)).rejects.toThrow(
      /larger than 50 MB/,
    )
    expect(h.puts).toEqual([])
  })

  it('streams a video over the old 100 MB cap into the bucket', async () => {
    const h = host({
      'https://cdn.shopify.com/long.mp4': () =>
        new Response(generated(120 * MB, MP4), {
          headers: { 'content-type': 'video/mp4', 'content-length': String(120 * MB) },
        }),
    })
    await expect(h.media.host('https://cdn.shopify.com/long.mp4', null)).resolves.toBeTruthy()
    expect(h.puts).toEqual([
      expect.objectContaining({ contentType: 'video/mp4', bytes: 120 * MB, streamed: true }),
    ])
  })

  it('streams a video without stream piping (Bun crashed the worker inside pipeThrough)', async () => {
    const proto = ReadableStream.prototype as unknown as Record<string, unknown>
    const saved = { pipeThrough: proto.pipeThrough, pipeTo: proto.pipeTo }
    const refuse = () => {
      throw new TypeError('undefined is not a function')
    }
    proto.pipeThrough = refuse
    proto.pipeTo = refuse
    try {
      const h = host({
        'https://cdn.shopify.com/clip.mp4': () =>
          new Response(generated(9 * MB, MP4), { headers: { 'content-type': 'video/mp4' } }),
      })
      await h.media.host('https://cdn.shopify.com/clip.mp4', null)
      expect(h.puts).toEqual([
        expect.objectContaining({ contentType: 'video/mp4', bytes: 9 * MB, streamed: true }),
      ])
    } finally {
      Object.assign(proto, saved)
    }
  })

  it('a video sent without a usable type is recognised from its first bytes and streamed', async () => {
    const h = host({
      'https://cdn.shopify.com/clip': () =>
        new Response(generated(3 * MB, MP4), {
          headers: { 'content-type': 'application/octet-stream' },
        }),
    })
    await h.media.host('https://cdn.shopify.com/clip', null)
    expect(h.puts).toEqual([
      expect.objectContaining({ contentType: 'video/mp4', bytes: 3 * MB, streamed: true }),
    ])
  })

  it('never holds more than the byte budget of whole-read copies at once', async () => {
    const body = sized(30 * MB)
    const urls = [0, 1, 2, 3].map((i) => `https://cdn.shopify.com/${i}.png`)
    const h = host(
      Object.fromEntries(urls.map((u) => [u, image(body)])),
      { bufferBudgetBytes: 64 * MB },
      20,
    )
    const ids = await Promise.all(urls.map((u) => h.media.host(u, null)))
    expect(ids.every(Boolean)).toBe(true)
    // 64 MB holds two 30 MB images; the other two wait their turn instead of all four at once.
    expect(h.writes.peak).toBe(2)
  })
})
