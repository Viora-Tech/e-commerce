'use client'

import { useState } from 'react'
import { reviewsWidgetContent as copy } from '../../data/reviews-widget'
import type { PublicReviewCard } from '../../types'
import RatingStars from '../rating-stars'

type ReviewCardProps = {
  review: PublicReviewCard
  storeName: string
  showPhotos: boolean
}

/** One review: who, verified badge, when, stars, title, text, photos, the store's reply, helpful. */
export default function ReviewCard({ review, storeName, showPhotos }: ReviewCardProps) {
  // Hooks
  const [helpful, setHelpful] = useState(review.helpful)
  const [voted, setVoted] = useState(false)

  // Event handlers
  const handleHelpful = async () => {
    if (voted) return
    setVoted(true)
    setHelpful((n) => n + 1)
    try {
      const res = await fetch('/reviews/helpful', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: review.id }),
      })
      const data = (await res.json().catch(() => null)) as { ok: boolean; count?: number } | null
      if (data?.ok && typeof data.count === 'number') setHelpful(data.count)
    } catch {
      // The vote stays counted on this page; a failed one is not worth an error message.
    }
  }

  // Render logic
  const initial = review.name.trim().charAt(0).toUpperCase()

  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius-m)] border border-line bg-surface p-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-bg text-sm font-semibold text-ink"
          aria-hidden="true"
        >
          {initial}
        </span>
        <span className="font-medium text-ink">{review.name}</span>
        {review.verified ? (
          <span className="rounded-sm bg-success/10 px-2 py-0.5 text-xs font-medium text-success">
            {copy.verified}
          </span>
        ) : null}
        <span className="ml-auto text-xs text-muted">{review.whenLabel}</span>
      </header>
      <RatingStars rating={review.rating} hideValue />
      {review.title ? (
        <h3 className="m-0 text-base font-semibold text-ink">{review.title}</h3>
      ) : null}
      <p className="m-0 whitespace-pre-line text-ink">{review.body}</p>
      {showPhotos && review.photos.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {review.photos.map((p) => (
            <a
              key={p.url}
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="block size-20 overflow-hidden rounded-md border border-line transition-[scale] duration-(--duration-press) ease-out active:scale-(--motion-card-press-scale)"
            >
              <img
                src={p.url}
                alt={copy.photoAlt(review.name)}
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            </a>
          ))}
        </div>
      ) : null}
      {review.reply ? (
        <div className="rounded-md bg-bg px-4 py-3">
          <p className="m-0 text-sm font-medium text-ink">{copy.replyFrom(storeName)}</p>
          <p className="m-0 mt-1 whitespace-pre-line text-sm text-muted">{review.reply}</p>
        </div>
      ) : null}
      <footer className="flex items-center gap-2 text-xs text-muted">
        <span>{copy.helpful}</span>
        <button
          type="button"
          onClick={handleHelpful}
          disabled={voted}
          aria-pressed={voted}
          className="inline-flex min-h-8 touch-manipulation items-center gap-1 rounded-md px-2 transition-colors hover:text-ink disabled:text-ink"
        >
          <span aria-hidden="true">{'\u{1F44D}'}</span>
          {voted ? copy.helpfulThanks : null} {copy.helpfulCount(helpful)}
        </button>
      </footer>
    </article>
  )
}
