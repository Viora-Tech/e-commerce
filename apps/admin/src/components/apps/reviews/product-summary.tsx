'use client'

import { RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import { reviewToolsContent } from '@/data/review-tools'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type ProductSummaryProps = {
  productId: string
}

type State = Awaited<ReturnType<typeof api.reviews.summary>>

/**
 * The product's AI "What customers say" text on its Reviews card: what shoppers see, when it
 * was written, why the last refresh failed, and "Refresh" to have it written again.
 */
export default function ProductSummary({ productId }: ProductSummaryProps) {
  // Hooks
  const { summary: copy } = useCopy(reviewToolsContent)
  const format = useFormat()
  // A failed read leaves the summary off.
  const { data: state, setData: setState } = useLoad<State>(
    () => api.reviews.summary({ productId }),
    [productId],
  )
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleRefresh = async () => {
    setBusy(true)
    try {
      await api.reviews.refreshSummary({ productId })
      toast.success(copy.queued)
      setState(await api.reviews.summary({ productId }))
    } catch (err) {
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (!state?.enabled) return null

  // Render logic
  const row = state.summary

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-body-strong">{copy.title}</span>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={busy || row?.stale}>
          <RefreshCw aria-hidden="true" />
          {row?.stale ? copy.pending : copy.refresh}
        </Button>
      </div>
      {row?.summary ? (
        <p className="text-body">{row.summary}</p>
      ) : (
        <EmptyState variant="inline" body={copy.none} />
      )}
      {row?.generatedAt && (
        <span className="text-caption text-muted-foreground">
          {copy.written(format.date(new Date(row.generatedAt)), row.reviewCount)}
        </span>
      )}
      {row?.error && <span className="text-caption text-destructive">{row.error}</span>}
    </div>
  )
}
