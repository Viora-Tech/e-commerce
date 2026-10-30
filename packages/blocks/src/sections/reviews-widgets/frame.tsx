import type { ComponentConfig } from '@puckeditor/core'
import type { ReactNode } from 'react'
import ReviewsWidgetHint from '../../components/reviews/widgets/reviews-widget-hint'
import SectionFrame from '../../components/section-frame'
import { reviewsWidgetsContent as copy } from '../../data/reviews-widgets'
import { widgetState } from '../../reviews-widgets'
import { type LegacySectionProps, migrateSectionSettings } from '../../section-settings'
import type { ReviewsLoader, StoreReviews, StoreReviewsQuery } from '../../types'
import { type Frame, framed } from '../framed'

/** Every Reviews section's saved props: its own settings, plus what the loader returned. */
export type ReviewsFrame = Frame & {
  /** Set by `resolveData`: undefined before it ran, null when the Reviews app is not installed. */
  resolved?: StoreReviews | null | undefined
}

export const yesNo = [
  { label: copy.fields.yes, value: true },
  { label: copy.fields.no, value: false },
]

export const cardStyleField = {
  type: 'select',
  label: copy.fields.cardStyle,
  options: [
    { label: copy.fields.styles.card, value: 'card' },
    { label: copy.fields.styles.outline, value: 'outline' },
    { label: copy.fields.styles.plain, value: 'plain' },
  ],
} as const

export const minRatingField = {
  type: 'select',
  label: copy.fields.minRating,
  options: [
    { label: copy.fields.any, value: 1 },
    { label: copy.fields.stars(3), value: 3 },
    { label: copy.fields.stars(4), value: 4 },
    { label: copy.fields.stars(5), value: 5 },
  ],
} as const

/**
 * A Reviews app section: `framed()` fields and defaults, its reviews read through `loadReviews`
 * in `resolveData` (never fetched on its own). With nothing to show (the app is not installed,
 * no published review matches) the storefront draws nothing at all and the editor a hint.
 */
export function reviewsFramed<P extends ReviewsFrame>(
  label: string,
  fields: Record<string, unknown>,
  defaults: Omit<P, keyof Frame | 'resolved'>,
  options: {
    loadReviews: ReviewsLoader | undefined
    query: (props: P) => StoreReviewsQuery
    body: (props: P, data: StoreReviews) => ReactNode
    /** The editor's hint when no review matches; the generic one otherwise. */
    emptyHint?: string | undefined
    defaultProps: P
  },
): ComponentConfig {
  const base = framed<P>(label, fields, defaults as Omit<P, keyof Frame>, () => null, {
    defaultProps: options.defaultProps,
  })
  return {
    ...base,
    resolveData: async ({ props }: { props: P }) => ({
      props: {
        resolved: options.loadReviews ? await options.loadReviews(options.query(props)) : undefined,
      },
      readOnly: { resolved: true },
    }),
    render: ({ puck, ...props }) => {
      const p = props as unknown as P
      const state = widgetState(p.resolved)
      if (state.kind !== 'ready' && puck?.isEditing !== true) return null
      const hint =
        state.kind === 'notInstalled'
          ? copy.hints.notInstalled
          : (options.emptyHint ?? copy.hints.noReviews)
      return (
        <SectionFrame settings={migrateSectionSettings(p as unknown as LegacySectionProps)}>
          {state.kind === 'ready' ? options.body(p, state.data) : <ReviewsWidgetHint text={hint} />}
        </SectionFrame>
      )
    },
  } as ComponentConfig
}
