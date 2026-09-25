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
