'use client'

import StatusChip from '@/components/layout/status-chip'
import { documentReviewContent } from '@/data/purchase-documents'
import { useCopy } from '@/hooks/use-copy'

/** "Check this": the AI was not sure about the value beside it. */
export default function UnsureMark() {
  // Hooks
  const copy = useCopy(documentReviewContent)

  return <StatusChip tone="attention">{copy.unsure}</StatusChip>
}
