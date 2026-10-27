'use client'

import DraftAddressFields from '@/components/drafts/draft-address-fields'
import type { DraftFormState } from '@/components/drafts/draft-form-state'
import DataCard from '@/components/layout/data-card'
import { draftEditorContent } from '@/data/drafts'
import { useCopy } from '@/hooks/use-copy'

type DraftAddressCardProps = {
  address: DraftFormState['address']
  onChange: (address: DraftFormState['address']) => void
}

/** Where the draft ships. Billing is its own card beside it (`DraftBillingCard`). */
export default function DraftAddressCard({ address, onChange }: DraftAddressCardProps) {
  // Hooks
  const copy = useCopy(draftEditorContent)

  // Render logic
  return (
    <DataCard title={copy.address.heading} bodyClassName="flex flex-col gap-4">
      <DraftAddressFields idPrefix="draft-addr" address={address} onChange={onChange} />
    </DataCard>
  )
}
