'use client'

import { TriangleAlert } from '@commerce/ui/icons'
import { documentReviewContent } from '@/data/purchase-documents'
import { useCopy } from '@/hooks/use-copy'

/** "Check this": the AI was not sure about the value beside it. */
export default function UnsureMark() {
  // Hooks
  const copy = useCopy(documentReviewContent)

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-caption font-medium text-warning">
      <TriangleAlert className="size-3" aria-hidden="true" />
      {copy.unsure}
    </span>
  )
}
