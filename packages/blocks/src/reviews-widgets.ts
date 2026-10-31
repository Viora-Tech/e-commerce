/**
 * SOURCE OF TRUTH KEYWORDS: reviews widgets helpers, review filter, top review
 * WHAT:  Pure helpers behind the Reviews app's theme sections: reading the products setting,
 *        the date line, the all-reviews filter, the snippet's best review and clipped quotes.
 * WHY:   Kept out of the components so the storefront, the editor and the tests share them.
 * WHERE: `sections/reviews-widgets/*`, `components/reviews/widgets/*`.
 */
import { formatInZone } from '@commerce/dates'
import type { PublicReviewCard, StoreReviewCard, StoreReviews } from './types'

/** `"glide-pad, veil-pad"` → `['glide-pad', 'veil-pad']`: the products setting, as handles. */
export function parseHandles(text: string | undefined): string[] {
  return [
    ...new Set(
      (text ?? '')
        .split(/[\s,]+/)
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean),
    ),
  ]
}

/** "12 Oct 2026": the same text on the server and in the browser, so the page hydrates cleanly. */
export function reviewDate(iso: string): string {
  const at = new Date(iso)
  return Number.isNaN(at.getTime())
    ? ''
    : formatInZone(
        at,
        { day: 'numeric', month: 'short', year: 'numeric' },
        { locale: 'en-GB', timeZone: 'UTC' },
      )
}

/** The all-reviews section's chips: every review, one star rating, or only those with photos. */
export type ReviewFilter = 'all' | 'photos' | 1 | 2 | 3 | 4 | 5

export function filterReviews<T extends Pick<StoreReviewCard, 'rating' | 'photos'>>(
  reviews: readonly T[],
  filter: ReviewFilter,
): T[] {
  if (filter === 'all') return [...reviews]
  if (filter === 'photos') return reviews.filter((r) => r.photos.length > 0)
  return reviews.filter((r) => r.rating === filter)
}

/** The star chips worth offering: ratings that have at least one review, highest first. */
export function starFilters(stars: readonly number[]): (1 | 2 | 3 | 4 | 5)[] {
  return ([5, 4, 3, 2, 1] as const).filter((n) => (stars[n - 1] ?? 0) > 0)
}

/**
 * The review the snippet near Add to cart quotes: the best rated, then the most helpful,
 * then the one with the most to say. Only 4★ and up, so the snippet never leads with a
 * complaint; none when no review qualifies.
 */
export function topReview(reviews: readonly PublicReviewCard[]): PublicReviewCard | null {
  const good = reviews.filter((r) => r.rating >= 4 && r.body.trim().length > 0)
  const sorted = [...good].sort(
    (a, b) => b.rating - a.rating || b.helpful - a.helpful || b.body.length - a.body.length,
  )
  return sorted[0] ?? null
}

/** A quote cut at a word near `max` characters, with an ellipsis when it was cut. */
export function clipText(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s.,;:!?-]+$/, '')}…`
}

/** What a Reviews section draws: its reviews, or why it has none (the editor shows a hint). */
export type ReviewsWidgetState =
  | { kind: 'ready'; data: StoreReviews }
  | { kind: 'notInstalled' }
  | { kind: 'empty' }

/** `resolved` is what the loader returned: undefined before it ran, null without the app. */
export function widgetState(resolved: StoreReviews | null | undefined): ReviewsWidgetState {
  if (resolved === null) return { kind: 'notInstalled' }
  if (!resolved || resolved.reviews.length === 0) return { kind: 'empty' }
  return { kind: 'ready', data: resolved }
}
