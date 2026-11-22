/** SOURCE OF TRUTH: the weekly SEO email's figures — WHAT: the snapshot kept each week (each page's Google position, impressions and clicks), which pages moved up or down since the last one (or, the first week, since the 28 days before), and the top three suggestions from the assistant's ranking / WHY: pure, so "moved" and "suggested" are tested without a database or Google. Client-safe */
import type { SeoIssueKind } from '../checks'
import type { SeoAssistantResource, SeoAssistantRow } from './opportunity'

/** One page in the week's snapshot. */
export type SeoSnapshotPage = { position: number; impressions: number; clicks: number }

/** The week's snapshot, by path (`/products/<handle>`). */
export type SeoSnapshot = Record<string, SeoSnapshotPage>

/** A page needs this many impressions for its move to count: fewer and a position is noise. */
export const MOVER_MIN_IMPRESSIONS = 30

/** Positions a page must move to be named. */
export const MOVER_MIN_CHANGE = 1

/** Pages named per direction, and suggestions per email. */
export const WEEKLY_LIST_MAX = 3

export type SeoMover = {
  resource: SeoAssistantResource
  id: string
  title: string
  path: string
  /** Position before and now (1 = top). */
  from: number
  to: number
}

/** What a suggestion asks for: the gap "Fix with AI" would close, or simply more text. */
export type SeoSuggestionKind = 'title' | 'description' | 'snippet'

export type SeoSuggestion = {
  resource: SeoAssistantResource
  id: string
  title: string
  kind: SeoSuggestionKind
  impressions: number
  position: number
  /** The search it is seen for most. */
  topQuery: string | null
}

export type SeoWeekly = {
  up: SeoMover[]
  down: SeoMover[]
  suggestions: SeoSuggestion[]
  /** Clicks and impressions over the last 28 days. */
  clicks: number
  impressions: number
  /** False the first week: moves are against the 28 days before, not last week. */
  sinceLastWeek: boolean
}

/** This week's snapshot from the assistant's rows. */
export function seoSnapshot(rows: readonly SeoAssistantRow[]): SeoSnapshot {
  const out: SeoSnapshot = {}
  for (const r of rows) {
    out[r.path] = {
      position: Math.round(r.current.position * 10) / 10,
      impressions: r.current.impressions,
      clicks: r.current.clicks,
    }
  }
  return out
}

const TITLE_GAPS: ReadonlySet<SeoIssueKind> = new Set([
  'title_missing',
  'title_long',
  'title_short',
  'title_duplicate',
])
const DESCRIPTION_GAPS: ReadonlySet<SeoIssueKind> = new Set([
  'description_missing',
  'description_long',
  'description_short',
  'description_duplicate',
  'low_ctr',
])

function suggestionKind(gaps: readonly SeoIssueKind[]): SeoSuggestionKind {
  if (gaps.some((g) => TITLE_GAPS.has(g))) return 'title'
  if (gaps.some((g) => DESCRIPTION_GAPS.has(g))) return 'description'
  return 'snippet'
}

/**
 * The email's figures. `last` is last week's snapshot (null the first week: the rows' own
 * previous 28 days stand in). Moves count only for pages seen at least
 * `MOVER_MIN_IMPRESSIONS` times now; up means a smaller position number.
 */
export function seoWeekly(rows: readonly SeoAssistantRow[], last: SeoSnapshot | null): SeoWeekly {
  const moves: (SeoMover & { delta: number })[] = []
  for (const r of rows) {
    if (r.current.impressions < MOVER_MIN_IMPRESSIONS || r.current.position <= 0) continue
    const before = last ? last[r.path]?.position : r.previous.position
    if (!before || before <= 0) continue
    const to = Math.round(r.current.position * 10) / 10
    const from = Math.round(before * 10) / 10
    const delta = from - to
    if (Math.abs(delta) < MOVER_MIN_CHANGE) continue
    moves.push({ resource: r.resource, id: r.id, title: r.title, path: r.path, from, to, delta })
  }
  const strip = ({ delta: _delta, ...m }: SeoMover & { delta: number }): SeoMover => m
  const up = moves
    .filter((m) => m.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, WEEKLY_LIST_MAX)
    .map(strip)
  const down = moves
    .filter((m) => m.delta < 0)
    .sort((a, b) => a.delta - b.delta)
    .slice(0, WEEKLY_LIST_MAX)
    .map(strip)
  const suggestions = rows
    .filter((r) => r.opportunity > 0)
    .slice(0, WEEKLY_LIST_MAX)
    .map((r) => ({
      resource: r.resource,
      id: r.id,
      title: r.title,
      kind: suggestionKind(r.gaps),
      impressions: r.current.impressions,
      position: Math.round(r.current.position * 10) / 10,
      topQuery: r.queries[0]?.query ?? null,
    }))
  return {
    up,
    down,
    suggestions,
    clicks: rows.reduce((s, r) => s + r.current.clicks, 0),
    impressions: rows.reduce((s, r) => s + r.current.impressions, 0),
    sinceLastWeek: last !== null,
  }
}

/** Whether the email has anything to say: no moves and no suggestions, no email. */
export const weeklyHasNews = (w: SeoWeekly): boolean =>
  w.up.length + w.down.length + w.suggestions.length > 0
