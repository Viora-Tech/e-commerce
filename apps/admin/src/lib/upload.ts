import { ALLOWED_CONTENT_TYPES, maxUploadBytesFor } from '@commerce/storage/keys'
import { mediaContent } from '@/data/media'
import { api } from '@/lib/api-client'

export type UploadedMedia = {
  id: string
  url: string
  alt: string | null
  contentType: string
}

export type UploadProgress = (fraction: number) => void

const MB = 1024 * 1024

/** Client-side gate so a wrong file fails before any network call; same limits as the server. */
export function rejectReason(file: File): string | null {
  if (!ALLOWED_CONTENT_TYPES.has(file.type)) return mediaContent.errors.type(file.name)
  const limit = maxUploadBytesFor(file.type)
  if (file.size > limit) return mediaContent.errors.size(file.name, Math.round(limit / MB))
  return null
}

/** Natural size for images; videos report nothing and the row stays without dimensions. */
async function imageDimensions(file: File): Promise<{ width?: number; height?: number }> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') return {}
  try {
    const bitmap = await createImageBitmap(file)
    const dims = { width: bitmap.width, height: bitmap.height }
    bitmap.close()
    return dims
  } catch {
    return {}
  }
}

/** XHR rather than fetch so upload progress events exist. Cookies go along for the local route. */
function put(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress?: UploadProgress,
) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`upload returned ${xhr.status}`))
    xhr.onerror = () => reject(new Error('network error during upload'))
    xhr.send(file)
  })
}

/**
 * presign → PUT straight to storage → confirm. Throws with a shopper-safe
 * message; the caller decides how to show it.
 */
export async function uploadFile(file: File, onProgress?: UploadProgress): Promise<UploadedMedia> {
  const reason = rejectReason(file)
  if (reason) throw new Error(reason)
  const dims = await imageDimensions(file)
  const ticket = await api.media.presign({
    filename: file.name,
    contentType: file.type,
    size: file.size,
    ...dims,
  })
  try {
    await put(ticket.upload.url, ticket.upload.headers, file, onProgress)
  } catch {
    throw new Error(mediaContent.errors.upload(file.name))
  }
  const row = await api.media.confirm({ id: ticket.mediaId, ...dims })
  return { id: row.id, url: row.url, alt: row.alt, contentType: row.contentType ?? file.type }
}
