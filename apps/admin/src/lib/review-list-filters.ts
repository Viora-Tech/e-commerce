import { parseAsArrayOf, parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs'
import type { DateFilterValue, FilterGroup } from '@/components/table/filter-panel'
import type { filterPanelContent } from '@/data/filter-panel'
import type { reviewsContent } from '@/data/reviews'
import {
  dateFilterBounds,
  hasDateFilter,
  NO_DATE_FILTER,
  parseAsDateFilter,
} from '@/lib/date-filter'
import {
  dateGroup,
  LAST_DAYS,
  lastDaysStart,
  windowInput,
  YES_NO,
  type YesNo,
  yesNoGroup,
  yesNoInput,
} from '@/lib/list-filter-parts'

/** Where a review came from, as stored. */
export const REVIEW_SOURCES = ['storefront', 'judgeme'] as const
type ReviewSource = (typeof REVIEW_SOURCES)[number]

const RATINGS = [5, 4, 3, 2, 1] as const

/** What the Reviews filter panel holds; arrays are "any of", empty for no filter. */
export type ReviewFilters = {
  /** Stars, 1–5. */
  rating: number[]
  /** Product ids. */
  product: string[]
  source: ReviewSource[]
  photos: YesNo | null
  verified: YesNo | null
  featured: YesNo | null
  replied: YesNo | null
  created: DateFilterValue
}

export const NO_REVIEW_FILTERS: ReviewFilters = {
  rating: [],
  product: [],
  source: [],
  photos: null,
  verified: null,
  featured: null,
  replied: null,
  created: NO_DATE_FILTER,
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change.
   `?rating=5` and `?product=<id>` from older links read as one pick. */
export const REVIEW_FILTER_PARAMS = {
  rating: parseAsArrayOf(parseAsInteger).withDefault([]),
  product: parseAsArrayOf(parseAsString).withDefault([]),
  source: parseAsArrayOf(parseAsStringLiteral(REVIEW_SOURCES)).withDefault([]),
  photos: parseAsStringLiteral(YES_NO),
  verified: parseAsStringLiteral(YES_NO),
  featured: parseAsStringLiteral(YES_NO),
  replied: parseAsStringLiteral(YES_NO),
  created: parseAsDateFilter(LAST_DAYS),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_REVIEW_FILTERS = {
  rating: null,
  product: null,
  source: null,
  photos: null,
  verified: null,
  featured: null,
  replied: null,
  created: null,
}

/** Stars the API accepts; anything else typed into the URL is dropped. */
function validRatings(rating: number[]): number[] {
  return RATINGS.filter((r) => rating.includes(r))
}

export function hasReviewFilters(f: ReviewFilters): boolean {
  return (
    validRatings(f.rating).length > 0 ||
    f.product.length > 0 ||
    f.source.length > 0 ||
    f.photos !== null ||
    f.verified !== null ||
    f.featured !== null ||
    f.replied !== null ||
    hasDateFilter(f.created)
  )
}

/** The panel as `reviews.list` input. */
export function reviewFilterInput(f: ReviewFilters, now = new Date()) {
  const ratings = validRatings(f.rating)
  const flags = {
    hasPhotos: yesNoInput(f.photos),
    verifiedBuyer: yesNoInput(f.verified),
    featured: yesNoInput(f.featured),
    replied: yesNoInput(f.replied),
  }
  return {
    ...(ratings.length ? { ratings } : {}),
    ...(f.product.length ? { productIds: f.product } : {}),
    ...(f.source.length ? { sources: f.source } : {}),
    ...(flags.hasPhotos === undefined ? {} : { hasPhotos: flags.hasPhotos }),
    ...(flags.verifiedBuyer === undefined ? {} : { verifiedBuyer: flags.verifiedBuyer }),
    ...(flags.featured === undefined ? {} : { featured: flags.featured }),
    ...(flags.replied === undefined ? {} : { replied: flags.replied }),
    ...windowInput('created', dateFilterBounds(f.created, lastDaysStart, now)),
  }
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function reviewFilterGroups(
  f: ReviewFilters,
  copy: (typeof reviewsContent)['list']['filters'],
  panel: typeof filterPanelContent,
  products: { id: string; title: string }[],
  onChange: (patch: Partial<ReviewFilters>) => void,
): FilterGroup[] {
  return [
    {
      key: 'rating',
      label: copy.rating,
      type: 'checks',
      options: RATINGS.map((n) => ({ value: String(n), label: copy.ratingValue(n) })),
      value: validRatings(f.rating).map(String),
      onChange: (next) => onChange({ rating: RATINGS.filter((r) => next.includes(String(r))) }),
    },
    {
      key: 'product',
      label: copy.product,
      type: 'multi',
      options: products.map((p) => ({ value: p.id, label: p.title })),
      value: f.product,
      onChange: (product) => onChange({ product }),
    },
    {
      key: 'source',
      label: copy.source,
      type: 'checks',
      options: REVIEW_SOURCES.map((s) => ({ value: s, label: copy.sources[s] })),
      value: f.source,
      onChange: (next) => onChange({ source: REVIEW_SOURCES.filter((s) => next.includes(s)) }),
    },
    yesNoGroup('photos', copy.photos, f.photos, (photos) => onChange({ photos }), {
      yesLabel: copy.yes,
      noLabel: copy.no,
    }),
    yesNoGroup('verified', copy.verified, f.verified, (verified) => onChange({ verified })),
    yesNoGroup('featured', copy.featured, f.featured, (featured) => onChange({ featured })),
    yesNoGroup('replied', copy.replied, f.replied, (replied) => onChange({ replied })),
    dateGroup('created', copy.created, f.created, (created) => onChange({ created }), panel),
  ]
}
