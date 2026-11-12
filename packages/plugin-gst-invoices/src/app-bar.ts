import { financialYear } from '@commerce/invoices'
import type { AppBarContext, AppBarSummary } from '@commerce/plugins'
import { queueBarRead } from './queue'

/** "2026-27" for the financial year `at` falls in (Indian FY, April to March). */
function numberingYear(at: Date): string {
  const fy = financialYear(at)
  return `${fy.startYear}-${fy.label.slice(3)}`
}

/**
 * The GST invoices app bar (Figma 928:10728): "GSTIN 06AB… · numbering 2026-27" and the Queue
 * count in the sidebar, from one statement. The count is only for members who can read orders,
 * like the queue itself.
 */
export async function gstAppBar({
  tx,
  storeId,
  can,
  now = new Date(),
}: Pick<AppBarContext, 'tx' | 'storeId' | 'can'> & { now?: Date }): Promise<AppBarSummary> {
  const count = can('orders.read')
  const { waiting, gstin } = await queueBarRead(tx, storeId, count)
  const year = numberingYear(now)
  return {
    statusPill: gstin
      ? { label: `GSTIN ${gstin} · numbering ${year}`, tone: 'neutral' }
      : { label: `No GSTIN yet · numbering ${year}`, tone: 'attention' },
    pageCounts: count ? { '': waiting } : {},
  }
}
