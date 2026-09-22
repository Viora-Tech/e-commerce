import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describeStorageProvider } from '@commerce/storage/testing'
import { describe, expect, it } from 'vitest'
import { LocalStorageProvider } from './local-storage'

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
