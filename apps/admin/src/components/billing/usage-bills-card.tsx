'use client'

import type { UsageBillView } from '@commerce/core'
import { Download, ExternalLink, ReceiptIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import { billingContent } from '@/data/billing'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { downloadCsv } from '@/lib/csv'

type UsageBillsCardProps = { bills: UsageBillView[] }

const TONE = {
  carried: 'neutral',
  due: 'attention',
  merged: 'info',
  paid: 'success',
  cancelled: 'neutral',
} as const

/** "Per-order fee bills": each month past the included orders, with Pay while due and its CSV. */
export default function UsageBillsCard({ bills }: UsageBillsCardProps) {
  // Hooks
  const copy = useCopy(billingContent)
  const format = useFormat()
  const [downloading, setDownloading] = useState<string | null>(null)

  // Event handlers
  const handleCsv = async (id: string) => {
    setDownloading(id)
    try {
      const file = await api.billing.usageBillCsv({ id })
      downloadCsv(file.filename, file.csv)
    } catch {
      toast.error(copy.feeBills.csvFailed)
    } finally {
      setDownloading(null)
    }
  }

  // Early returns
  if (bills.length === 0) {
    return (
      <DataCard title={copy.feeBills.heading}>
        <EmptyState
          variant="plain"
          size="sm"
          icon={ReceiptIcon}
          heading={copy.feeBills.empty}
          body={copy.feeBills.emptyBody}
        />
      </DataCard>
    )
  }

  // Render logic
  const b = copy.feeBills

  return (
    <DataCard title={b.heading} flush>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">{b.month}</TableHead>
            <TableHead className="text-right">{b.orders}</TableHead>
            <TableHead className="text-right">{b.amount}</TableHead>
            <TableHead>{b.status}</TableHead>
            <TableHead className="pr-4" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {bills.map((bill) => (
            <TableRow key={bill.id}>
              <TableCell className="pl-4 font-medium text-foreground">
                {format.pattern(`${bill.month}-15T00:00:00Z`, { month: 'short', year: 'numeric' })}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {format.number(bill.feeOrders)}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex flex-col items-end">
                  <span className="tabular-nums">{format.money(bill.totalPaise)}</span>
                  <span className="text-caption text-muted-foreground">{b.gst}</span>
                </div>
              </TableCell>
              <TableCell>
                <StatusChip tone={TONE[bill.status]} variant="dot">
                  {b.states[bill.status]}
                </StatusChip>
              </TableCell>
              <TableCell className="pr-4">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={downloading === bill.id}
                    onClick={() => void handleCsv(bill.id)}
                  >
                    <Download />
                    {b.csv}
                  </Button>
                  {bill.url && (bill.status === 'due' || bill.status === 'paid') ? (
                    <Button
                      size="sm"
                      variant={bill.status === 'due' ? 'default' : 'ghost'}
                      nativeButton={false}
                      render={<a href={bill.url} target="_blank" rel="noopener noreferrer" />}
                    >
                      {bill.status === 'due' ? b.pay : b.view}
                      <ExternalLink />
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DataCard>
  )
}
