import { describe, expect, it } from 'vitest'
import { mediaKey } from './keys'
import type { StorageProvider } from './types'

export type ConformanceOptions = {
  /** Fresh provider per test. */
  create: () => StorageProvider | Promise<StorageProvider>
  /** Runs live network calls (presign is offline everywhere; delete and verify are not). */
  live?: boolean
  /** True when put/get need no network (memory, local folder); runs the round-trip offline. */
  offlineObjects?: boolean
}

const sampleKey = mediaKey({
  storeId: '00000000-0000-7000-8000-000000000000',
  filename: 'Mousepad Front.PNG',
  contentType: 'image/png',
  id: 'conformance',
})

/**
 * Behavioural contract every StorageProvider must satisfy. Offline checks
 * always run; live checks only when `live` is true and credentials exist.
 */
export function describeStorageProvider(name: string, opts: ConformanceOptions): void {
  describe(`StorageProvider conformance: ${name}`, () => {
    it('has a stable lowercase id and a label', async () => {
      const a = await opts.create()
      const b = await opts.create()
      expect(a.id).toMatch(/^[a-z][a-z0-9-]*$/)
      expect(a.id).toBe(b.id)
      expect(a.label.length).toBeGreaterThan(0)
    })

    it('gives an absolute, stable public URL that ends with the key', async () => {
      const p = await opts.create()
      const url = p.publicUrl(sampleKey)
      expect(url).toMatch(/^https?:\/\//)
      expect(url.endsWith(sampleKey)).toBe(true)
      expect(p.publicUrl(sampleKey)).toBe(url)
    })

    it('presigns a PUT or POST with an absolute URL, a content type and an expiry', async () => {
      const p = await opts.create()
      const r = await p.presignUpload({ key: sampleKey, contentType: 'image/png', size: 1234 })
      expect(r.url).toMatch(/^https?:\/\//)
      expect(['PUT', 'POST']).toContain(r.method)
      expect(r.expiresIn).toBeGreaterThan(0)
      const ct = Object.entries(r.headers).find(([k]) => k.toLowerCase() === 'content-type')
      expect(ct?.[1]).toBe('image/png')
    })

    if (opts.offlineObjects || opts.live) {
      it('writes bytes with put, reads them back with get, and gets null once deleted', async () => {
        const p = await opts.create()
        const key = `${sampleKey}.roundtrip.pdf`
        const body = new TextEncoder().encode('%PDF-1.7 conformance')
        await p.put({ key, body, contentType: 'application/pdf' })
        const back = await p.get(key)
        expect(back && new TextDecoder().decode(back)).toBe('%PDF-1.7 conformance')
        await p.delete(key)
        expect(await p.get(key)).toBeNull()
        expect(await p.get(`${sampleKey}.never-written`)).toBeNull()
      })
    }

    if (opts.live) {
      it('answers verifyCredentials with an actionable message instead of throwing', async () => {
        const p = await opts.create()
        const r = await p.verifyCredentials()
        expect(typeof r.ok).toBe('boolean')
        expect(r.message.length).toBeGreaterThan(0)
      })

      it('deleting a key that does not exist resolves', async () => {
        const p = await opts.create()
        await expect(p.delete(`${sampleKey}.missing`)).resolves.toBeUndefined()
      })
    }
  })
}
