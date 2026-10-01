import type { StorageProvider } from '@commerce/storage'
import { describe, expect, it } from 'vitest'
import { createMediaHost } from '../src/media'
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

function host(routes: Record<string, () => Response>) {
  const puts: { key: string; contentType: string }[] = []
  const fetched: string[] = []
  const provider = {
    id: 'memory',
    put: async (o: { key: string; contentType: string }) => {
      puts.push({ key: o.key, contentType: o.contentType })
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
  })
  return { media, puts, fetched }
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
