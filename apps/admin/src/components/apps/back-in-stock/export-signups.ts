import { toast } from 'sonner'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { downloadCsv, toCsv } from '@/lib/csv'

type ExportCopy = { header: readonly string[]; file: string; failed: string }

/**
 * "Export signups" (Essential's Export notifications): every signup with its whole email and
 * number as a CSV download. Shared by the Overview and Signups headers.
 */
export async function exportSignups(copy: ExportCopy): Promise<void> {
  try {
    const rows = await api.backInStock.signups.export()
    const csv = toCsv(
      [...copy.header],
      rows.map((r) => [
        r.product,
        r.variant,
        r.email,
        r.phone,
        r.status,
        new Date(r.createdAt),
        r.notifiedAt ? new Date(r.notifiedAt) : null,
      ]),
    )
    downloadCsv(copy.file, csv)
  } catch (err) {
    toast.error(errorText(err, copy.failed))
  }
}
