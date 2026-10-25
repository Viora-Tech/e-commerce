import { parseQuery } from '@commerce/core/analytics-query'
import type { SavedReportRange, StoreTx } from '@commerce/db'
import { savedReport } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { and, desc, eq } from 'drizzle-orm'
import { findReport } from './analytics-reports'

/** The report slug a saved custom query is filed under; its text lives in `query`. */
const QUERY_REPORT_SLUG = 'query'

const QUERY_REPORT_TITLE = 'Custom query'

/** The query text checked by the same parser that runs it; never saved when it does not parse. */
function checkedQuery(query: string | null | undefined): string {
  const parsed = parseQuery(query ?? '')
  if (!parsed.ok) {
    throw new ORPCError('BAD_REQUEST', {
      message: `The query has a problem on line ${parsed.error.line}: ${parsed.error.message}`,
    })
  }
  return (query ?? '').trim()
}

function titleOf(reportSlug: string): string | null {
  if (reportSlug === QUERY_REPORT_SLUG) return QUERY_REPORT_TITLE
  const report = findReport(reportSlug)
  return report?.available ? report.title : null
}

/** Analytics → Reports' saved reports, newest first, with the catalogue report each runs. */
export async function listSavedReports(tx: StoreTx) {
  const rows = await tx.select().from(savedReport).orderBy(desc(savedReport.createdAt))
  return rows.flatMap((r) => {
    const reportTitle = titleOf(r.reportSlug)
    return reportTitle ? [{ ...r, reportTitle }] : []
  })
}

/** One saved report, for opening a saved custom query in the editor. */
export async function getSavedReport(tx: StoreTx, id: string) {
  const [row] = await tx.select().from(savedReport).where(eq(savedReport.id, id))
  if (!row) throw new ORPCError('NOT_FOUND')
  return row
}

export async function saveReport(
  tx: StoreTx,
  storeId: string,
  input: { name: string; reportSlug: string; range: SavedReportRange; query?: string | undefined },
  createdBy: string | null,
) {
  const isQuery = input.reportSlug === QUERY_REPORT_SLUG
  if (!isQuery && !findReport(input.reportSlug)?.available) {
    throw new ORPCError('BAD_REQUEST', { message: 'That report is not available.' })
  }
  const [row] = await tx
    .insert(savedReport)
    .values({
      storeId,
      name: input.name.trim(),
      reportSlug: input.reportSlug,
      range: input.range,
      query: isQuery ? checkedQuery(input.query) : null,
      createdBy,
    })
    .returning()
  return row
}

export async function renameSavedReport(tx: StoreTx, id: string, name: string) {
  const [row] = await tx
    .update(savedReport)
    .set({ name: name.trim(), updatedAt: new Date() })
    .where(eq(savedReport.id, id))
    .returning()
  if (!row) throw new ORPCError('NOT_FOUND')
  return row
}

/** Saves a custom query's new text (and name and range) over the saved one; only query reports. */
export async function updateSavedQuery(
  tx: StoreTx,
  input: { id: string; name: string; query: string; range: SavedReportRange },
) {
  const query = checkedQuery(input.query)
  const [row] = await tx
    .update(savedReport)
    .set({ name: input.name.trim(), query, range: input.range, updatedAt: new Date() })
    .where(and(eq(savedReport.id, input.id), eq(savedReport.reportSlug, QUERY_REPORT_SLUG)))
    .returning()
  if (!row) throw new ORPCError('NOT_FOUND')
  return row
}

export async function deleteSavedReport(tx: StoreTx, id: string) {
  await tx.delete(savedReport).where(eq(savedReport.id, id))
}
