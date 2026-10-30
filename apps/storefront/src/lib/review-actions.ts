import 'server-only'
import { loadEnv, settingsSecret } from '@commerce/config'
import { enqueueMediaProcess, saveImageForProcessing, storageForStore } from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import {
  markHelpful,
  openPhotoToken,
  openRequestLink,
  parseReviewForm,
  photoToken,
  askQuestion,
  parseQuestionForm,
  QuestionRejected,
  ReviewRejected,
  reviewsState,
  submitReview,
} from '@commerce/plugin-reviews/server'
import { mediaProcessQueue } from '@commerce/queue'
import { headers } from 'next/headers'
import { currentCustomer } from './customer-session'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/*
 * The Reviews app's storefront endpoints (`/reviews/photo`, `/reviews/submit`,
 * `/reviews/helpful`). The store is always the one the hostname resolved to (`x-store-id`),
 * never anything in the body; the shopper comes from their session or a signed review
 * request link. Every endpoint is rate-limited per IP and store, and the form carries a
 * honeypot field a person never sees.
 */

/** The hidden field the write-a-review form adds; a person never fills it. */
export const REVIEW_HONEYPOT = 'review_website'

const PHOTO_RULE = { limit: 30, windowMs: 10 * 60_000 }
const SUBMIT_RULE = { limit: 10, windowMs: 60 * 60_000 }
const QUESTION_RULE = { limit: 10, windowMs: 60 * 60_000 }
/** One helpful vote per visitor and review a month. */
const HELPFUL_RULE = { limit: 1, windowMs: 30 * 24 * 60 * 60_000 }

/** What a shopper may upload as a review photo; GIF and AVIF are not needed for reviews. */
const PHOTO_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export type ReviewJson =
  | { ok: true; status?: 'published' | 'pending'; token?: string; url?: string; count?: number }
  | { ok: false; error: string; field?: string }

async function installed(storeId: string): Promise<boolean> {
  return inStore(storeId, async (tx) => (await reviewsState(tx, storeId)).installed)
}

async function ipKey(storeId: string): Promise<string> {
  return `${storeId}:${clientIp(await headers())}`
}

/**
 * One review photo, before the review is sent: saved like an upload (the media pipeline
 * strips location data and makes the sizes) and answered with a signed token, so the review
 * can only attach photos this visitor uploaded to this store.
 */
export async function uploadReviewPhoto(form: FormData): Promise<ReviewJson> {
  const storeId = await requestStoreId()
  if (!(await rateLimited('review-photo:ip', await ipKey(storeId), PHOTO_RULE)).ok) {
    return { ok: false, error: 'busy' }
  }
  if (!(await installed(storeId))) return { ok: false, error: 'product' }
  const file = form.get('photo')
  if (!(file instanceof Blob) || !PHOTO_TYPES.has(file.type.toLowerCase())) {
    return { ok: false, error: 'photo' }
  }
  const env = loadEnv(process.env)
  try {
    const saved = await inStore(storeId, async (tx) => {
      const provider = await storageForStore(
        tx,
        storeId,
        (await registriesForStore(tx, storeId)).storage,
        env.SETTINGS_SECRET,
      )
      return saveImageForProcessing(tx, storeId, provider, {
        filename: file instanceof File ? file.name : 'review-photo',
        contentType: file.type,
        bytes: new Uint8Array(await file.arrayBuffer()),
      })
    })
    await enqueueMediaProcess(mediaProcessQueue(env.REDIS_URL), {
      storeId,
      mediaId: saved.mediaId,
    })
    return { ok: true, token: photoToken(settingsSecret(), storeId, saved.mediaId), url: saved.url }
  } catch {
    return { ok: false, error: 'photo' }
  }
}

/** The write-a-review form. A filled honeypot answers "sent" without saving, so a bot learns nothing. */
export async function submitReviewForm(form: FormData): Promise<ReviewJson> {
  const storeId = await requestStoreId()
  if (!(await rateLimited('review-submit:ip', await ipKey(storeId), SUBMIT_RULE)).ok) {
    return { ok: false, error: 'busy' }
  }
  const trap = form.get(REVIEW_HONEYPOT)
  if (typeof trap === 'string' && trap.trim() !== '') return { ok: true, status: 'pending' }
  const secret = settingsSecret()
  const me = await currentCustomer(storeId)
  const rawToken = form.get('review_token')
  const requestLink =
    typeof rawToken === 'string' ? openRequestLink(secret, rawToken, storeId) : null
  const parsed = parseReviewForm(form, { emailKnown: Boolean(me?.email || requestLink) })
  if (!parsed.ok) return { ok: false, error: parsed.field, field: parsed.field }
  const photoMediaIds = form
    .getAll('photos')
    .map((t) => openPhotoToken(secret, t, storeId))
    .filter((id): id is string => id !== null)
  try {
    const result = await inStore(storeId, async (tx) => {
      const state = await reviewsState(tx, storeId)
      if (!state.installed) throw new ReviewRejected('product')
      return submitReview(
        tx,
        storeId,
        {
          ...parsed.value,
          photoMediaIds,
          customer: me ? { id: me.id, email: me.email } : null,
          requestLink,
        },
        state.settings,
      )
    })
    return { ok: true, status: result.status }
  } catch (err) {
    if (err instanceof ReviewRejected) {
      return { ok: false, error: err.reason === 'invalid' ? (err.field ?? 'generic') : err.reason }
    }
    return { ok: false, error: 'generic' }
  }
}

/**
 * "Ask a question" (product Q&A): saved waiting for the merchant's answer. A filled honeypot
 * answers "sent" without saving, like the review form.
 */
export async function submitQuestionForm(form: FormData): Promise<ReviewJson> {
  const storeId = await requestStoreId()
  if (!(await rateLimited('review-question:ip', await ipKey(storeId), QUESTION_RULE)).ok) {
    return { ok: false, error: 'busy' }
  }
  const trap = form.get(REVIEW_HONEYPOT)
  if (typeof trap === 'string' && trap.trim() !== '') return { ok: true, status: 'pending' }
  const parsed = parseQuestionForm(form)
  if (!parsed.ok) return { ok: false, error: parsed.field, field: parsed.field }
  const me = await currentCustomer(storeId)
  try {
    await inStore(storeId, async (tx) => {
      if (!(await reviewsState(tx, storeId)).installed) throw new QuestionRejected('product')
      return askQuestion(tx, storeId, { ...parsed.value, customerId: me?.id ?? null })
    })
    return { ok: true, status: 'pending' }
  } catch (err) {
    if (err instanceof QuestionRejected) return { ok: false, error: err.reason }
    return { ok: false, error: 'generic' }
  }
}

/** "Was this helpful?": one vote per visitor and review. */
export async function markReviewHelpful(id: unknown): Promise<ReviewJson> {
  const storeId = await requestStoreId()
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: 'generic' }
  if (!(await rateLimited('review-helpful', `${await ipKey(storeId)}:${id}`, HELPFUL_RULE)).ok) {
    return { ok: false, error: 'busy' }
  }
  const count = await inStore(storeId, (tx) => markHelpful(tx, id))
  return count === null ? { ok: false, error: 'generic' } : { ok: true, count }
}
