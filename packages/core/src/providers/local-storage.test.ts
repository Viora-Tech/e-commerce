import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describeStorageProvider } from '@commerce/storage/testing'
import { describe, expect, it } from 'vitest'
import { assertSafeKey, LocalStorageProvider, localStoragePath } from './local-storage'

const dir = mkdtempSync(join(tmpdir(), 'commerce-local-storage-'))
const create = () => new LocalStorageProvider({ baseUrl: 'http://localhost:3200', dir })

describeStorageProvider('local', { create, offlineObjects: true })

describe('LocalStorageProvider', () => {
  it('refuses a key that climbs out of the folder', async () => {
    await expect(
      create().put({
        key: '../escape.pdf',
        body: new Uint8Array(1),
        contentType: 'application/pdf',
      }),
    ).rejects.toThrow(/traversal/)
  })

  it("deletePrefix removes one store's folder and leaves its neighbours", async () => {
    const p = create()
    const body = new Uint8Array([1])
    const contentType = 'image/png'
    await p.put({ key: 'stores/ab/media/a.png', body, contentType })
    await p.put({ key: 'stores/ab/private/exports/x.zip', body, contentType })
    await p.put({ key: 'stores/abc/media/b.png', body, contentType })
    expect(await p.deletePrefix('stores/ab/')).toBe(2)
    expect(await p.get('stores/ab/media/a.png')).toBeNull()
    expect(await p.get('stores/abc/media/b.png')).not.toBeNull()
    // A store with no folder at all is fine, and a non-folder prefix is refused.
    expect(await p.deletePrefix('stores/none/')).toBe(0)
    await expect(p.deletePrefix('stores/a')).rejects.toThrow()
  })
})

describe('path traversal guard', () => {
  const UNSAFE = [
    '../escape.pdf',
    '..\\..\\escape.pdf',
    'a/..\\..\\escape.pdf',
    '%2e%2e/escape.pdf',
    '%2e%2e%2fescape.pdf',
    'a/../../escape.pdf',
    '/etc/passwd',
    'C:\\Windows\\win.ini',
    'a\0b.pdf',
  ]

  it.each(UNSAFE)('localStoragePath refuses %s', (key) => {
    expect(() => localStoragePath(key, dir)).toThrow(/traversal|unsafe/)
  })

  it('assertSafeKey refuses backslashes, NUL and absolute paths outright', () => {
    expect(() => assertSafeKey('..\\..\\x')).toThrow(/unsafe/)
    expect(() => assertSafeKey('a\0b')).toThrow(/unsafe/)
    expect(() => assertSafeKey('/etc/passwd')).toThrow(/unsafe/)
  })

  it('still accepts a normal, in-folder key', () => {
    expect(localStoragePath('stores/s1/media/a.png', dir)).toContain(
      join('stores', 's1', 'media', 'a.png'),
    )
  })
})
