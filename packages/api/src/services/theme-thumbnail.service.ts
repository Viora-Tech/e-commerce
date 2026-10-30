import { CommerceError, uploadThemeThumbnail } from '@commerce/core'

/**
 * The theme library's pictures: Customize draws the home page into a small webp in the browser
 * (modern-screenshot, the same capture "Report a bug" uses) and sends it here on Save. One
 * object per theme, overwritten each time, so a theme never leaves a trail of old pictures; the
 * URL carries the time so browsers fetch the new one. Developer docs: Theme editor > Thumbnails.
 */

/** A 640 × 400 webp is 15–60 KB; anything near this is not a thumbnail. */
const THUMBNAIL_MAX_BYTES = 256 * 1024
/** The longest data URL a 256 KB image makes (base64 is 4 characters per 3 bytes). */
export const THUMBNAIL_DATA_URL_MAX = 32 + Math.ceil(THUMBNAIL_MAX_BYTES / 3) * 4

const DATA_URL = /^data:image\/webp;base64,([A-Za-z0-9+/]+={0,2})$/

export class InvalidThumbnail extends CommerceError {
  constructor(message: string) {
    super('THEME_THUMBNAIL_INVALID', message)
  }
}

/** Bytes of a webp data URL, at most 256 KB, whose header really says RIFF…WEBP. */
export function decodeThumbnail(dataUrl: string): Uint8Array {
  const m = dataUrl.match(DATA_URL)
  if (!m) throw new InvalidThumbnail('The thumbnail must be a WebP image.')
  const bytes = new Uint8Array(Buffer.from(m[1] as string, 'base64'))
  if (bytes.byteLength > THUMBNAIL_MAX_BYTES) {
    throw new InvalidThumbnail('The thumbnail is over 256 KB.')
  }
  const riff = String.fromCharCode(...bytes.subarray(0, 4))
  const webp = String.fromCharCode(...bytes.subarray(8, 12))
  if (riff !== 'RIFF' || webp !== 'WEBP') {
    throw new InvalidThumbnail('The thumbnail must be a WebP image.')
  }
  return bytes
}

/** Writes the picture and resolves the URL to store (shared with the worker's screenshots). */
export const uploadThumbnail = uploadThemeThumbnail
