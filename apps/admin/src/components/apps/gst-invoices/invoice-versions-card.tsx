'use client'

import DataCard from '@/components/layout/data-card'
import { gstInvoiceEditContent } from '@/data/gst-invoice-edit'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import InvoiceHistoryList from './invoice-history-list'

type Version = Awaited<ReturnType<typeof api.gstInvoices.getEdit>>['versions'][number]

type InvoiceVersionsCardProps = {
  invoiceId: string
  versions: Version[]
}

/**
 * The invoice page's edit history: each earlier version's totals and PDF. Shown once the
 * invoice was edited; Edit invoice itself is in the header's ⋯ menu (owner, 28 Nov 2026).
 */
export default function InvoiceVersionsCard({ invoiceId, versions }: InvoiceVersionsCardProps) {
  // Hooks
  const copy = useCopy(gstInvoiceEditContent.history)

  // Early returns
  if (versions.length === 0) return null

  // Render logic
  return (
    <DataCard bodyClassName="flex flex-col" title={copy.title}>
      <InvoiceHistoryList invoiceId={invoiceId} versions={versions} />
    </DataCard>
  )
}
