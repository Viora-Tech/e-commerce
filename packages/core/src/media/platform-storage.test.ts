import { StorageRegistry } from '@commerce/storage'
import { describe, expect, it } from 'vitest'
import { effectiveStorageSettings, storageRegistryFor } from './settings'

const env = {
  R2_ACCOUNT_ID: 'acct',
  R2_ACCESS_KEY_ID: 'key',
  R2_SECRET_ACCESS_KEY: 'secret',
  R2_BUCKET: 'platform-bucket',
  R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
}
const own = (bucket: string) => ({
  enabled: ['r2'],
  providers: { r2: { bucket } },
  migration: null,
})

describe('effectiveStorageSettings', () => {
  it('gives a store with nothing saved the platform bucket', () => {
    expect(effectiveStorageSettings(null, env).enabled).toEqual(['r2'])
  })

  it('treats saved settings with nothing enabled as no choice', () => {
    const raw = { enabled: [], providers: {}, migration: null }
    expect(effectiveStorageSettings(raw, env).providers.r2?.bucket).toBe('platform-bucket')
  })

  it('keeps a saved choice', () => {
    expect(effectiveStorageSettings(own('merchant'), env).providers.r2?.bucket).toBe('merchant')
  })
})

describe('storageRegistryFor', () => {
  const installed = new StorageRegistry()
  const all = new StorageRegistry()

  it('reaches the platform bucket without the app', () => {
    expect(storageRegistryFor(null, env, installed, all)).toBe(all)
    expect(storageRegistryFor(own('platform-bucket'), env, installed, all)).toBe(all)
  })

  it('keeps a merchant bucket behind its installed app', () => {
    expect(storageRegistryFor(own('merchant'), env, installed, all)).toBe(installed)
  })

  it('keeps installed providers when the deployment has no bucket', () => {
    expect(storageRegistryFor(null, {}, installed, all)).toBe(installed)
  })
})
