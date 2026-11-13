import { describe, expect, it } from 'vitest'
import { warmPages, warmupUrls } from './storefront-warmup'

describe('storefront warm-up', () => {
  it('loads each host’s front pages with a query that skips the edge copy', () => {
    expect(warmupUrls(['www.waimers.in', 'www.clawgears.in'], 42)).toEqual([
      'https://www.waimers.in/?warmup=42',
      'https://www.waimers.in/collections/all?warmup=42',
      'https://www.clawgears.in/?warmup=42',
      'https://www.clawgears.in/collections/all?warmup=42',
    ])
  })

  it('loads one page at a time and counts failures without stopping', async () => {
    const seen: string[] = []
    let open = 0
    let most = 0
    const fetcher = (async (url: string) => {
      open++
      most = Math.max(most, open)
      seen.push(url)
      await new Promise((r) => setTimeout(r, 1))
      open--
      if (url.includes('bad')) throw new Error('down')
      return new Response('<html></html>', { status: url.includes('missing') ? 404 : 200 })
    }) as unknown as typeof fetch
    const result = await warmPages(['https://a/', 'https://bad/', 'https://missing/'], fetcher)
    expect(seen).toHaveLength(3)
    expect(most).toBe(1)
    expect(result).toMatchObject({ ok: 1, failed: 2 })
  })
})
