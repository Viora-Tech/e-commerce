'use client'

import type { StoreLocation } from '@/components/inventory/location-select'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import { transferFormContent, transfersContent } from '@/data/inventory'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { TransferLine } from './transfer-lines-card'

type TransferSummaryCardProps = {
  status: keyof typeof transfersContent.status | null
  lines: TransferLine[]
  locations: StoreLocation[]
  fromLocationId: string
  toLocationId: string
}

/** Figma transfer, side column (652:3592): status, units and the two ends of the route. */
export default function TransferSummaryCard({
  status,
  lines,
  locations,
  fromLocationId,
  toLocationId,
}: TransferSummaryCardProps) {
  // Hooks
  const { summary: copy } = useCopy(transferFormContent)
  const { status: statusLabels } = useCopy(transfersContent)
  const fmt = useFormat()

  // Helpers
  const nameOf = (id: string) => locations.find((l) => l.id === id)?.name ?? null

  // Render logic
  const units = lines.reduce((n, l) => n + (Number(l.quantity) || 0), 0)

  return (
    <DataCard title={copy.heading}>
      <KeyValueList
        variant="grid"
        rows={[
          { label: copy.status, value: status ? statusLabels[status] : copy.newDraft },
          { label: copy.units, value: fmt.number(units) },
          { label: copy.from, value: nameOf(fromLocationId) },
          { label: copy.to, value: nameOf(toLocationId) },
        ]}
      />
    </DataCard>
  )
}
