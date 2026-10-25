/**
 * How large a copy from Shopify may be. The importer's own limits, larger than a
 * browser upload's (`maxUploadBytesFor` in `@commerce/storage`): a Shopify store
 * already holds these files, and refusing them on import only leaves holes.
 *
 * Images (and anything else read whole) are capped so memory stays bounded; the
 * byte budget (`BUFFER_BUDGET_BYTES`) keeps several large ones from being held
 * at once. Videos stream into the bucket in parts and are never held whole, so
 * their cap is only a guard against filling the bucket by mistake.
 */
import { isImageContentType, VIDEO_MAX_UPLOAD_BYTES } from '@commerce/storage'

const MB = 1024 * 1024

/** Images: Shopify takes up to 20 MB (older stores have larger originals). */
const IMPORT_IMAGE_MAX_BYTES = 50 * MB
/** Videos, streamed: Shopify takes up to 1 GB. */
export const IMPORT_VIDEO_MAX_BYTES = 1024 * MB
/**
 * A video that has to be read whole because the storage cannot take a stream
 * (the local folder used in development): the same 100 MB as a browser upload.
 */
const BUFFERED_VIDEO_MAX_BYTES = VIDEO_MAX_UPLOAD_BYTES
/**
 * Bytes of whole-read copies held at once across one import. Each copy reserves
 * its size (the full cap when the source does not say) before it reads, and
 * gives it back once stored, so 16 copies in flight never mean 16 x 50 MB.
 */
export const BUFFER_BUDGET_BYTES = 96 * MB

/** The cap for a copy of this type. */
export function importMaxBytesFor(contentType: string, streamed: boolean): number {
  if (isImageContentType(contentType)) return IMPORT_IMAGE_MAX_BYTES
  return streamed ? IMPORT_VIDEO_MAX_BYTES : BUFFERED_VIDEO_MAX_BYTES
}

/** `52428800` → `50 MB`, `1073741824` → `1 GB`. */
export function sizeText(bytes: number): string {
  return bytes >= 1024 * MB ? `${Math.round(bytes / 1024 / MB)} GB` : `${Math.round(bytes / MB)} MB`
}
