import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { GET } from './route'

const dir = mkdtempSync(join(tmpdir(), 'commerce-uploads-route-'))

beforeAll(() => {
  process.env.LOCAL_STORAGE_DIR = dir
  mkdirSync(join(dir, 'stores/store-1/media'), { recursive: true })
  writeFileSync(join(dir, 'stores/store-1/media/a1-mousepad.png'), 'fake-png-bytes')
  writeFileSync(
    join(dir, 'stores/store-1/media/legacy.svg'),
    '<svg onload="alert(1)"><script>alert(2)</script></svg>',
  )
})

afterAll(() => {
  delete process.env.LOCAL_STORAGE_DIR
})

const req = (key: string[]) =>
  GET(new Request('http://localhost/uploads/x'), { params: Promise.resolve({ key }) })

describe('GET /uploads/[...key]', () => {
  it('serves a stored file with the right content type and cache headers', async () => {
    const res = await req(['stores', 'store-1', 'media', 'a1-mousepad.png'])
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(await res.text()).toBe('fake-png-bytes')
  })

  it('always sends nosniff and a locked-down CSP', async () => {
    const res = await req(['stores', 'store-1', 'media', 'a1-mousepad.png'])
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('content-security-policy')).toBe("default-src 'none'; sandbox")
  })

  it('serves a legacy .svg (no longer accepted on upload) as a forced download, never inline', async () => {
    const res = await req(['stores', 'store-1', 'media', 'legacy.svg'])
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/svg+xml')
    expect(res.headers.get('content-disposition')).toBe('attachment')
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
  })

  it('404s a missing key', async () => {
    const res = await req(['stores', 'store-1', 'media', 'nope.png'])
    expect(res.status).toBe(404)
  })

  it('refuses a key that climbs out of the folder', async () => {
    const res = await req(['stores', 'store-1', '..', '..', 'etc', 'passwd.png'])
    expect(res.status).toBe(404)
  })

  it('refuses a content type the media library does not allow', async () => {
    mkdirSync(join(dir, 'stores/store-1/media'), { recursive: true })
    writeFileSync(join(dir, 'stores/store-1/media/script.exe'), 'x')
    const res = await req(['stores', 'store-1', 'media', 'script.exe'])
    expect(res.status).toBe(404)
  })
})
