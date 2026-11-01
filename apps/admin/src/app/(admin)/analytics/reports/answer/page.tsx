import { ANSWER_REPORT_SLUG, parseSnapshot } from '@commerce/api'
import type { Metadata } from 'next'
import AnswerReportView, { type SavedAnswer } from '@/components/analytics/answer-report-view'
import { appRouter, call, serverContext } from '@/lib/api'
import type { SearchParams } from '@/lib/list-query'

export const metadata: Metadata = { title: 'AI answer' }

type Props = { searchParams: Promise<SearchParams> }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * An AI answer's table as a report (#102): a saved snapshot (`?saved=`), or the one the
 * assistant just handed over in this tab.
 */
export default async function Page({ searchParams }: Props) {
  const { saved: savedParam } = await searchParams
  const savedId = typeof savedParam === 'string' && UUID.test(savedParam) ? savedParam : null
  const context = await serverContext()
  const row = savedId
    ? await call(appRouter.analytics.getSavedReport, { id: savedId }, { context }).catch(() => null)
    : null
  const snapshot = row?.reportSlug === ANSWER_REPORT_SLUG ? parseSnapshot(row.query) : null
  const saved: SavedAnswer | null =
    row && snapshot ? { id: row.id, name: row.name, snapshot } : null
  return <AnswerReportView key={saved?.id ?? 'new'} saved={saved} />
}
