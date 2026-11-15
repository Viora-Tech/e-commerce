'use client'

import { TriangleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type ReviewCardProps = {
  affiliateId: string
  reasons: string[]
  onChanged: () => void
}

/** On an affiliate's page while their payouts wait for a look: why, and "Looks fine". */
export default function ReviewCard({ affiliateId, reasons, onChanged }: ReviewCardProps) {
  // Hooks
  const { detail: d, failed } = useCopy(affiliatesContent)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleClear = async () => {
    setBusy(true)
    try {
      await api.affiliates.clearReview({ id: affiliateId })
      toast.success(d.review.cleared)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <Alert
      tone="warning"
      action={
        <Button variant="outline" onClick={handleClear} loading={busy}>
          {d.review.clear}
        </Button>
      }
    >
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{d.review.title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-1">
        <ul className="flex list-disc flex-col gap-0.5 pl-4 text-body text-foreground">
          {reasons.map((r) => (
            <li key={r}>{d.review.reasons[r] ?? r}</li>
          ))}
        </ul>
        <span className="text-caption">{d.review.help}</span>
      </AlertDescription>
    </Alert>
  )
}
