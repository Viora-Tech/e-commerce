'use client'

import { TriangleAlert } from '@commerce/ui/icons'
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
    <div className="flex flex-col gap-3 rounded-xl border border-warning/40 bg-warning-soft px-5 py-4">
      <div className="flex items-start gap-2.5">
        <TriangleAlert
          className="mt-0.5 size-4 shrink-0 text-warning-foreground dark:text-warning"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1">
          <p className="text-body-strong">{d.review.title}</p>
          <ul className="flex list-disc flex-col gap-0.5 pl-4 text-body">
            {reasons.map((r) => (
              <li key={r}>{d.review.reasons[r] ?? r}</li>
            ))}
          </ul>
          <p className="text-caption text-muted-foreground">{d.review.help}</p>
        </div>
      </div>
      <div>
        <Button variant="outline" onClick={handleClear} disabled={busy}>
          {d.review.clear}
        </Button>
      </div>
    </div>
  )
}
