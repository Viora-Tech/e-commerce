'use client'

import { type FormEvent, useState } from 'react'
import { reviewsWidgetContent as copy } from '../../data/reviews-widget'
import type { ReviewsWidgetContext } from '../../types'
import Icon from '../icon'
import ReviewPhotoInput, { type UploadedPhoto } from './review-photo-input'
import StarPicker from './star-picker'

type ReviewFormProps = {
  context: ReviewsWidgetContext
  onClose: () => void
}

type Result = { ok: true; status: 'published' | 'pending' } | { ok: false; error?: string }

const MAX_PHOTOS = 5
const FIELD =
  'w-full rounded-md border border-line bg-bg px-3 py-2.5 text-base text-ink outline-none transition-[border-color] focus-visible:border-brand md:text-sm'

const errorText = (key: string | undefined): string =>
  (key && (copy.form.errors as Record<string, string>)[key]) || copy.form.errors.generic

/**
 * Write a review (Storefront 21:160): star picker, title, text, up to five photos, the name
 * shown as first name and last initial, and the verified-buyer note. Posts to
 * `/reviews/submit`; a hidden field catches bots.
 */
export default function ReviewForm({ context, onClose }: ReviewFormProps) {
  // Hooks
  const [rating, setRating] = useState(0)
  const [photos, setPhotos] = useState<UploadedPhoto[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState<'published' | 'pending' | null>(null)

  // Event handlers
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (rating === 0) {
      setError(copy.form.errors.rating)
      return
    }
    const body = new FormData(event.currentTarget)
    body.set('product_id', context.productId)
    body.set('rating', String(rating))
    for (const p of photos) body.append('photos', p.token)
    if (context.requestToken) body.set('review_token', context.requestToken)
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/reviews/submit', { method: 'POST', body })
      const data = (await res.json().catch(() => null)) as Result | null
      if (res.ok && data?.ok) setDone(data.status)
      else setError(errorText(data?.ok === false ? data.error : undefined))
    } catch {
      setError(copy.form.errors.generic)
    } finally {
      setSending(false)
    }
  }
  // A review that went live shows after a reload; one that waits needs nothing more.
  const handleDone = () => (done === 'published' ? window.location.reload() : onClose())

  // Early returns
  if (done) {
    return (
      <div className="flex flex-col items-start gap-3 p-6">
        <h2 className="m-0 text-xl font-semibold text-ink">{copy.form.thanksTitle}</h2>
        <p className="m-0 text-ink">
          {done === 'published' ? copy.form.thanksLive : copy.form.thanksHeld}
        </p>
        <button type="button" className="btn btn--primary" onClick={handleDone}>
          {copy.form.done}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-6" noValidate>
      <header className="flex items-start gap-3">
        {context.productImage ? (
          <img
            src={context.productImage}
            alt=""
            width={48}
            height={48}
            loading="lazy"
            decoding="async"
            className="size-12 shrink-0 rounded-md border border-line object-cover"
          />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="m-0 text-xl font-semibold text-ink">{copy.form.title}</h2>
          <p className="m-0 truncate text-sm text-muted">{context.productTitle}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.form.close}
          className="flex size-9 touch-manipulation items-center justify-center rounded-md text-muted hover:text-ink"
        >
          <Icon name="close" size={16} />
        </button>
      </header>
      <StarPicker value={rating} onChange={setRating} />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        {copy.form.reviewTitle}
        <input
          name="title"
          maxLength={150}
          placeholder={copy.form.reviewTitlePlaceholder}
          className={FIELD}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        {copy.form.body}
        <textarea
          name="body"
          required
          rows={4}
          maxLength={5000}
          placeholder={copy.form.bodyPlaceholder}
          className={FIELD}
        />
      </label>
      <ReviewPhotoInput
        photos={photos}
        max={MAX_PHOTOS}
        onChange={setPhotos}
        onError={setError}
        endpoint="/reviews/photo"
      />
      <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
        {copy.form.name}
        <input
          name="name"
          required
          maxLength={80}
          autoComplete="name"
          defaultValue={context.knownName}
          className={FIELD}
        />
        <span className="font-normal text-muted">{copy.form.nameHelp}</span>
      </label>
      {context.emailKnown ? null : (
        <label className="flex flex-col gap-1.5 text-sm font-medium text-ink">
          {copy.form.email}
          <input name="email" type="email" required autoComplete="email" className={FIELD} />
          <span className="font-normal text-muted">{copy.form.emailHelp}</span>
        </label>
      )}
      {/* Spam trap: hidden from people, so only a script fills it. */}
      <div hidden aria-hidden="true">
        <input type="text" name="review_website" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      {context.verifiedOrder ? (
        <p className="m-0 rounded-md bg-success/10 px-3 py-2.5 text-sm text-success">
          {copy.form.verifiedNote(context.verifiedOrder)}
        </p>
      ) : null}
      {error ? (
        <p className="m-0 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn--primary w-full" disabled={sending}>
        {sending ? copy.form.sending : copy.form.send}
      </button>
    </form>
  )
}
