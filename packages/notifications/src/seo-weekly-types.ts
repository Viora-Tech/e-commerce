/**
 * The weekly SEO email the store owner gets while Google Search Console is connected (Online
 * store › SEO › Search opportunities). Built by `@commerce/core` (seo/assistant/weekly-service.ts)
 * from the stored Google numbers; the email's words come from `templates/content-seo.ts`.
 */

/** A page whose Google position changed: `from` and `to` are positions (1 = top). */
export type SeoWeeklyMover = { title: string; from: number; to: number; url: string }

/** What the suggestion asks the merchant to do. */
export type SeoWeeklySuggestionKind = 'title' | 'description' | 'snippet'

export type SeoWeeklySuggestion = {
  title: string
  kind: SeoWeeklySuggestionKind
  impressions: number
  position: number
  topQuery: string | null
  url: string
}

export type SeoWeeklyEmail = {
  /** "Week of 23 November". */
  periodLabel: string
  /** Last 28 days, already formatted ("1,240"). */
  clicksLabel: string
  impressionsLabel: string
  /** False the first week: moves are against the 28 days before, not last week. */
  sinceLastWeek: boolean
  up: SeoWeeklyMover[]
  down: SeoWeeklyMover[]
  suggestions: SeoWeeklySuggestion[]
  /** Online store › SEO › Search opportunities in the admin. */
  url: string
}
