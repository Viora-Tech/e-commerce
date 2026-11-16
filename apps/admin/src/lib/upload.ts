import { ALLOWED_CONTENT_TYPES, maxUploadBytesFor } from '@commerce/storage/keys'
import { ORPCError } from '@orpc/client'
import { mediaContent } from '@/data/media'
import { api } from '@/lib/api-client'
import { grabVideoPoster } from '@/lib/video-poster'

export type UploadedMedia = {
  id: string
  url: string
  alt: string | null
  contentType: string
}

export type UploadProgress = (fraction: number) => void

const MB = 1024 * 1024
const GB = 1024 * MB

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
  const ticket = await api.media
    .presign({ filename: file.name, contentType: file.type, size: file.size, ...dims })
    .catch((err: unknown) => {
      if (err instanceof ORPCError && err.data?.reason === 'storage_limit')
        throw new Error(mediaContent.errors.storageFull(Number(err.data.limitBytes) / GB))
      throw err
    })
  try {
    await put(ticket.upload.url, ticket.upload.headers, file, onProgress)
  } catch {
    throw new Error(mediaContent.errors.upload(file.name))
  }
  const row = await api.media.confirm({ id: ticket.mediaId, ...dims })
  if (file.type.startsWith('video/')) await attachPoster(file, row.id)
  return { id: row.id, url: row.url, alt: row.alt, contentType: row.contentType ?? file.type }
}

/**
 * A new video gets a poster picture: a frame about 2 s in that is not black (`video-poster.ts`),
 * uploaded like any picture and linked to the video. Best effort: a video the browser cannot read,
 * or a failed poster upload, leaves the video without one and the upload still succeeds.
 */
async function attachPoster(video: File, videoId: string): Promise<boolean> {
  try {
    const poster = await grabVideoPoster(video)
    if (!poster) return false
    const uploaded = await uploadFile(poster)
    await api.media.setPoster({ id: videoId, posterId: uploaded.id })
    return true
  } catch {
    // The video is saved; a poster can still be picked by hand in Customize.
    return false
  }
}

/**
 * A poster for a video already in Files (uploaded before posters were made on upload): the video
 * is read from its address and gets a poster the same way a new upload does. True when it worked.
 */
export async function makeVideoPoster(video: { id: string; url: string }): Promise<boolean> {
  try {
    const res = await fetch(video.url)
    if (!res.ok) return false
    const blob = await res.blob()
    const name = video.url.split('/').pop()?.split('?')[0] || 'video.mp4'
    return await attachPoster(new File([blob], name, { type: blob.type || 'video/mp4' }), video.id)
  } catch {
    return false
  }
}
