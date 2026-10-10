import type { SavedReportRange, StoreTx } from '@commerce/db'
import { savedReport } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { desc, eq } from 'drizzle-orm'
import { findReport } from './analytics-reports'

/** Analytics → Reports' saved reports, newest first, with the catalogue report each runs. */
export async function listSavedReports(tx: StoreTx) {
  const rows = await tx.select().from(savedReport).orderBy(desc(savedReport.createdAt))
  return rows
    .map((r) => ({ ...r, report: findReport(r.reportSlug) }))
    .filter((r) => r.report?.available)
    .map(({ report, ...r }) => ({ ...r, reportTitle: report?.title ?? r.reportSlug }))
}

export async function saveReport(
  tx: StoreTx,
  storeId: string,
  input: { name: string; reportSlug: string; range: SavedReportRange },
  createdBy: string | null,
) {
  if (!findReport(input.reportSlug)?.available) {
    throw new ORPCError('BAD_REQUEST', { message: 'That report is not available.' })
  }
  const [row] = await tx
    .insert(savedReport)
    .values({
      storeId,
      name: input.name.trim(),
      reportSlug: input.reportSlug,
      range: input.range,
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

export async function deleteSavedReport(tx: StoreTx, id: string) {
  await tx.delete(savedReport).where(eq(savedReport.id, id))
}
