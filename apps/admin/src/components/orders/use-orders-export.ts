import { useState } from 'react'
import { toast } from 'sonner'
import { ordersContent } from '@/data/orders'
import { ordersBulkContent } from '@/data/orders-bulk'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { downloadCsv } from '@/lib/csv'
import { ordersCsv } from '@/lib/orders-csv'

/** Most ids one `orders.sheet` call takes. */
const SHEET_CHUNK = 5000

/**
 * Download orders as a CSV: the bulk bar's selection, or the whole current view from the page's
 * More actions (#12). `ids` may be a promise, so the view's ids load only once asked.
 */
export function useOrdersExport() {
  // Hooks
  const copy = useCopy(ordersContent)
  const bulkCopy = useCopy(ordersBulkContent)
  const [exporting, setExporting] = useState(false)

  // Event handlers
  const exportOrders = async (ids: string[] | (() => Promise<string[]>)) => {
    setExporting(true)
    try {
      const all = typeof ids === 'function' ? await ids() : ids
      const rows = []
      for (let i = 0; i < all.length; i += SHEET_CHUNK) {
        rows.push(...(await api.orders.sheet({ ids: all.slice(i, i + SHEET_CHUNK) })))
      }
      downloadCsv(
        `orders-${new Date().toISOString().slice(0, 10)}.csv`,
        ordersCsv(copy, bulkCopy, rows),
      )
      toast.success(bulkCopy.exportDone(rows.length))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : bulkCopy.exportFailed)
    } finally {
      setExporting(false)
    }
  }

  return { exporting, exportOrders }
}
