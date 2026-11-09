import { describe, expect, it } from 'vitest'
import {
  cacheControlFor,
  IMAGE_MAX_UPLOAD_BYTES,
  isAllowedContentType,
  keyBelongsToStore,
  MEDIA_CACHE_CONTROL,
  maxUploadBytesFor,
  mediaKey,
  safeFilename,
  VIDEO_MAX_UPLOAD_BYTES,
} from '../src/keys'
import { MemoryStorageProvider } from '../src/memory'
import { StorageRegistry } from '../src/registry'
import { describeStorageProvider } from '../src/testing'

describe('media keys', () => {
  it('builds a per-store key with a safe name and the right extension', () => {
    const key = mediaKey({
      storeId: 's1',
      filename: 'Mousepad Front (v2).PNG',
      contentType: 'image/png',
      id: 'abc',
    })
    expect(key).toBe('stores/s1/media/abc-mousepad-front-v2.png')
  })

  it('falls back to "file" and "bin" for hostile names and unknown types', () => {
    expect(safeFilename('....')).toBe('file')
    expect(
      mediaKey({ storeId: 's', filename: '💥', contentType: 'application/x-thing', id: 'x' }),
    ).toBe('stores/s/media/x-file.bin')
  })

  it('only accepts web images and mp4', () => {
    expect(isAllowedContentType('image/webp')).toBe(true)
    expect(isAllowedContentType('IMAGE/JPEG')).toBe(true)
    expect(isAllowedContentType('video/mp4')).toBe(true)
    expect(isAllowedContentType('video/quicktime')).toBe(false)
    expect(isAllowedContentType('application/pdf')).toBe(false)
  })

  it('caps images at 10 MB and mp4 video at 100 MB', () => {
    expect(IMAGE_MAX_UPLOAD_BYTES).toBe(10 * 1024 * 1024)
    expect(VIDEO_MAX_UPLOAD_BYTES).toBe(100 * 1024 * 1024)
    expect(maxUploadBytesFor('image/png')).toBe(IMAGE_MAX_UPLOAD_BYTES)
    expect(maxUploadBytesFor('IMAGE/JPEG')).toBe(IMAGE_MAX_UPLOAD_BYTES)
    expect(maxUploadBytesFor('video/mp4')).toBe(VIDEO_MAX_UPLOAD_BYTES)
  })

  it('refuses SVG (XML that can carry <script>, so never on the upload allow-list)', () => {
    expect(isAllowedContentType('image/svg+xml')).toBe(false)
    expect(isAllowedContentType('IMAGE/SVG+XML')).toBe(false)
  })

  it('refuses keys from another store or with traversal', () => {
    expect(keyBelongsToStore('stores/a/media/x.png', 'a')).toBe(true)
    expect(keyBelongsToStore('stores/b/media/x.png', 'a')).toBe(false)
    expect(keyBelongsToStore('stores/a/../b/x.png', 'a')).toBe(false)
  })
})

describe('StorageRegistry', () => {
  it('creates a provider from a registered factory and rejects unknown ids', () => {
    const r = new StorageRegistry().register({
      id: 'memory',
      label: 'Memory',
      fields: [],
      validateConfig: () => ({ ok: true, config: {} }),
      create: () => new MemoryStorageProvider(),
    })
    expect(r.ids()).toEqual(['memory'])
    expect(r.create('memory', {}).ok).toBe(true)
    expect(r.create('nope', {})).toEqual({ ok: false, errors: ['unknown storage provider: nope'] })
  })
})

describeStorageProvider('memory', { create: () => new MemoryStorageProvider(), live: true })

describe('cacheControlFor', () => {
  const media = 'stores/s1/media/abc-photo'
  it("keeps the caller's header", () => {
    expect(
      cacheControlFor({ key: `${media}.jpg`, contentType: 'image/jpeg', cacheControl: 'no-store' }),
    ).toBe('no-store')
  })
  it('caches a video under a media key for a year, also under a key prefix', () => {
    expect(cacheControlFor({ key: `${media}.mp4`, contentType: 'video/mp4' })).toBe(
      MEDIA_CACHE_CONTROL,
    )
    expect(cacheControlFor({ key: `tenant/${media}.mp4`, contentType: 'video/mp4' })).toBe(
      MEDIA_CACHE_CONTROL,
    )
  })
  it('leaves an unprocessed image and anything outside media uncached', () => {
    expect(cacheControlFor({ key: `${media}.jpg`, contentType: 'image/jpeg' })).toBeUndefined()
    expect(
      cacheControlFor({ key: 'stores/s1/invoices/1.pdf', contentType: 'application/pdf' }),
    ).toBeUndefined()
    expect(
      cacheControlFor({ key: 'stores/s1/exports/a.mp4', contentType: 'video/mp4' }),
    ).toBeUndefined()
  })
})
