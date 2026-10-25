import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import { abandonedDetailContent } from '@/data/abandoned-detail'
import { useCopy } from '@/hooks/use-copy'
import type { AbandonedCheckout } from './abandoned-detail-types'

type AbandonedCustomerCardProps = {
  checkout: AbandonedCheckout
}

export default function AbandonedCustomerCard({ checkout }: AbandonedCustomerCardProps) {
  // Hooks
  const copy = useCopy(abandonedDetailContent).customer

  // Render logic
  const rows = [
    { label: copy.name, value: checkout.customerName || copy.none },
    { label: copy.email, value: checkout.email || copy.none },
    { label: copy.phone, value: checkout.phone || copy.none },
    { label: copy.source, value: checkout.source || copy.none },
  ]

  return (
    <DataCard title={copy.heading}>
      <KeyValueList rows={rows} variant="grid" />
    </DataCard>
  )
}
