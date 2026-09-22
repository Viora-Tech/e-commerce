import { inventoryContent } from '@/data/inventory'
import type { api } from '@/lib/api-client'
import { downloadCsv, toCsv } from '@/lib/csv'

type Row = Awaited<ReturnType<typeof api.inventory.exportRows>>[number]

const copy = inventoryContent.exporting

const rupees = (paise: number | null) => (paise == null ? '' : (paise / 100).toFixed(2))

/** One CSV line per SKU at the chosen location. */
export function downloadInventoryCsv(rows: Row[], locationName: string) {
  downloadCsv(
    copy.filename,
    toCsv(
      [...copy.headers],
      rows.map((r) => [
        r.productTitle,
        r.variantTitle,
        r.sku,
        locationName,
        r.available,
        r.committed,
        r.incoming,
        r.onHand,
        rupees(r.costPaise),
      ]),
    ),
  )
}
