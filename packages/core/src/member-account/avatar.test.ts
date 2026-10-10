/** SOURCE OF TRUTH: member avatar tests — WHAT: re-encoding, refusal of non-images and key scoping / WHY: avatars are untrusted uploads */
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import {
  avatarKey,
  decodeAvatarDataUrl,
  InvalidAvatar,
  isOwnAvatarKey,
  processAvatar,
} from './avatar'

describe('processAvatar', () => {
  it('turns any photo into a small square WebP without metadata', async () => {
    const photo = await sharp({
      create: { width: 900, height: 600, channels: 3, background: '#3366cc' },
    })
      .jpeg()
      .withMetadata({ exif: { IFD0: { Copyright: 'someone' } } })
      .toBuffer()
    const out = await processAvatar(new Uint8Array(photo))
    const meta = await sharp(out).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(256)
    expect(meta.height).toBe(256)
    expect(meta.exif).toBeUndefined()
  })

  it('refuses bytes that are not an image', async () => {
    await expect(processAvatar(new TextEncoder().encode('<svg onload=alert(1)>'))).rejects.toThrow(
      InvalidAvatar,
    )
  })
})

describe('avatar keys', () => {
  it('sit in the store folder and only match the same member', () => {
    const key = avatarKey('store-1', 'user_1', 'abc')
    expect(key).toBe('stores/store-1/avatars/user_1/abc.webp')
    expect(isOwnAvatarKey(key, 'store-1', 'user_1')).toBe(true)
    expect(isOwnAvatarKey(key, 'store-1', 'user_2')).toBe(false)
    expect(isOwnAvatarKey(key, 'store-2', 'user_1')).toBe(false)
    expect(isOwnAvatarKey('stores/store-1/avatars/user_1/../x.webp', 'store-1', 'user_1')).toBe(
      false,
    )
  })
})

describe('decodeAvatarDataUrl', () => {
  it('reads a photo data URL and refuses anything else', () => {
    expect(decodeAvatarDataUrl('data:image/webp;base64,AAEC')).toEqual(new Uint8Array([0, 1, 2]))
    expect(() => decodeAvatarDataUrl('data:image/svg+xml;base64,AAEC')).toThrow(InvalidAvatar)
    expect(() => decodeAvatarDataUrl('https://example.com/a.png')).toThrow(InvalidAvatar)
  })
})
