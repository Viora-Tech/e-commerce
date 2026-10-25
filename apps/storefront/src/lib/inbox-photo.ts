import 'server-only'
import { loadEnv } from '@commerce/config'
import { enqueueMediaProcess, saveImageForProcessing, storageForStore } from '@commerce/core'
import { IMAGE_MAX_BYTES, inboxState } from '@commerce/core/inbox/server'
import { registriesForStore } from '@commerce/core/registries'
import { mediaProcessQueue } from '@commerce/queue'
import { chatPhotoToken } from './inbox'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/** What a shopper may send as a chat photo. */
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
/** Per IP and store; the per-conversation limit (5 an hour) applies when it is sent. */
const PHOTO_RULE = { limit: 10, windowMs: 60 * 60_000 }

export type ChatPhotoJson = { ok: true; token: string; url: string } | { ok: false; error: string }

/**
 * One chat photo, saved like an upload (the media pipeline strips location data and makes the
 * sizes), answered with a signed token so a message can attach only what this browser uploaded
 * to this store (the same way the Reviews app's `/reviews/photo` works).
 */
export async function uploadChatPhoto(request: Request): Promise<ChatPhotoJson> {
  const storeId = await requestStoreId()
  if (
    !(await rateLimited('inbox-photo:ip', `${storeId}:${clientIp(request.headers)}`, PHOTO_RULE)).ok
  ) {
    return { ok: false, error: 'busy' }
  }
  const form = await request.formData().catch(() => null)
  const file = form?.get('photo')
  if (!(file instanceof Blob) || !PHOTO_TYPES.has(file.type.toLowerCase())) {
    return { ok: false, error: 'photo' }
  }
  if (file.size > IMAGE_MAX_BYTES) return { ok: false, error: 'size' }
  const env = loadEnv(process.env)
  try {
    const saved = await inStore(storeId, async (tx) => {
      if (!(await inboxState(tx, storeId)).installed) return null
      const provider = await storageForStore(
        tx,
        storeId,
        (await registriesForStore(tx, storeId)).storage,
        env.SETTINGS_SECRET,
      )
      return saveImageForProcessing(tx, storeId, provider, {
        filename: file instanceof File ? file.name : 'chat-photo',
        contentType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })
    })
    if (!saved) return { ok: false, error: 'photo' }
    await enqueueMediaProcess(mediaProcessQueue(env.REDIS_URL), { storeId, mediaId: saved.mediaId })
    return { ok: true, token: chatPhotoToken(storeId, saved.mediaId), url: saved.url }
  } catch {
    return { ok: false, error: 'photo' }
  }
}
