/** SOURCE OF TRUTH: member avatar, profile photo — WHAT: a team member's photo, re-encoded server-side to one small square WebP under the active store's folder, outside the media library / WHY: the browser crops it, but the server must not trust those bytes: re-encoding drops EXIF/GPS and anything that is not an image */
import sharp from 'sharp'
import { CommerceError } from '../errors'
import { LIMIT_INPUT_PIXELS } from '../media/pipeline'

/** Edge of the stored square, in pixels: sharp on a 2x screen at the largest size shown. */
const AVATAR_SIZE = 256

/** The browser sends a cropped square well under this; anything bigger is refused unread. */
const AVATAR_MAX_UPLOAD_BYTES = 2 * 1024 * 1024

/** The longest data URL `AVATAR_MAX_UPLOAD_BYTES` makes (base64 is 4 characters per 3 bytes). */
export const AVATAR_DATA_URL_MAX =
  'data:image/webp;base64,'.length + Math.ceil(AVATAR_MAX_UPLOAD_BYTES / 3) * 4

export class InvalidAvatar extends CommerceError {
  constructor(message: string) {
    super('INVALID_AVATAR', message)
  }
}

const DATA_URL = /^data:image\/(?:webp|jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/

/** The bytes of the cropped photo the admin sends as a WebP, JPEG or PNG data URL. */
export function decodeAvatarDataUrl(dataUrl: string): Uint8Array {
  const match = DATA_URL.exec(dataUrl)
  if (!match?.[1])
    throw new InvalidAvatar('That file is not a photo we can read. Try a JPG or PNG.')
  return new Uint8Array(Buffer.from(match[1], 'base64'))
}

/** `stores/<storeId>/avatars/<userId>/<id>.webp`: inside the store folder, so closing the store removes it. */
export function avatarKey(storeId: string, userId: string, id: string): string {
  return `stores/${storeId}/avatars/${userId.replace(/[^\w-]/g, '')}/${id}.webp`
}

/** True when `key` is one of this member's avatars in this store (what may be deleted on replace). */
export function isOwnAvatarKey(key: string, storeId: string, userId: string): boolean {
  const prefix = `stores/${storeId}/avatars/${userId.replace(/[^\w-]/g, '')}/`
  return key.startsWith(prefix) && !key.includes('..') && !key.slice(prefix.length).includes('/')
}

/**
 * Any accepted image in, a centred `AVATAR_SIZE` square WebP out: auto-rotated, metadata
 * stripped, first frame only. Throws `InvalidAvatar` for oversize or undecodable input.
 */
export async function processAvatar(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.byteLength === 0) throw new InvalidAvatar('Choose a photo to upload')
  if (bytes.byteLength > AVATAR_MAX_UPLOAD_BYTES) {
    throw new InvalidAvatar('That photo is too large. Try a smaller one.')
  }
  try {
    const out = await sharp(bytes, { limitInputPixels: LIMIT_INPUT_PIXELS, animated: false })
      .rotate()
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'cover', position: 'centre' })
      .webp({ quality: 82 })
      .toBuffer()
    return new Uint8Array(out)
  } catch {
    throw new InvalidAvatar('That file is not a photo we can read. Try a JPG or PNG.')
  }
}
