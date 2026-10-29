'use client'

import { AiIcon, RotateCcw } from '@commerce/ui/icons'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import KitButton from '@/components/kit/kit-button'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import ApprovalDialog from '@/components/mcp/approval-dialog'
import { assistantContent } from '@/data/assistant'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Item = Awaited<ReturnType<typeof api.ai.activity>>['items'][number]

const BADGE: Record<string, 'attention' | 'success' | 'danger' | 'neutral'> = {
  proposed: 'attention',
  executed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  expired: 'neutral',
  undone: 'neutral',
}

/**
 * Settings → AI → Activity: every change the AI assistant or a bulk "Write with AI" made in
 * the store, newest first, who approved it, and Undo where the change can be undone.
 */
export default function AiActivityCard() {
  // Hooks
  const copy = useCopy(assistantContent)
  const fmt = useFormat()
  const [items, setItems] = useState<Item[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [failed, setFailed] = useState(false)
  const [undoing, setUndoing] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<string | null>(null)

  useEffect(() => {
    api.ai
      .activity({ page, perPage: 10 })
      .then((res) => {
        setItems((prev) => (page === 1 ? res.items : [...(prev ?? []), ...res.items]))
        setHasMore(res.hasMore)
      })
      .catch(() => setFailed(true))
  }, [page])

  // Helpers
  const decidedBy = (item: Item) => {
    if (!item.by) return null
    return item.status === 'cancelled'
      ? copy.activity.cancelledBy(item.by)
      : copy.activity.approvedBy(item.by)
  }

  // Event handlers
  const handleUndo = async (id: string) => {
    setUndoing(id)
    try {
      const view = await api.ai.undoAction({ id })
      setItems((all) => (all ?? []).map((i) => (i.id === id ? view : i)))
      if (view.undoMessage) toast.success(view.undoMessage)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.card.failed)
    } finally {
      setUndoing(null)
    }
  }

  return (
    <DataCard
      title={
        <>
          <AiIcon className="size-5 text-primary" aria-hidden="true" />
          {copy.activity.heading}
        </>
      }
      subtitle={copy.activity.help}
    >
      {failed ? (
        <p className="text-body text-muted-foreground">{copy.activity.failed}</p>
      ) : items === null ? (
        <Skeleton className="h-32 w-full rounded-xl" />
      ) : items.length === 0 ? (
        <EmptyState variant="dashed" size="sm" body={copy.activity.empty} />
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-body font-medium break-words text-ink-strong">
                    {item.summary}
                  </p>
                  <p className="text-caption text-muted-foreground">
                    {[
                      copy.activity.sources[item.source] ?? item.source,
                      fmt.when(item.executedAt ?? item.createdAt),
                      item.requestedBy ? copy.activity.askedBy(item.requestedBy) : null,
                      decidedBy(item),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  {item.status === 'undone' && item.undoMessage ? (
                    <p className="text-caption text-muted-foreground">{item.undoMessage}</p>
                  ) : null}
                  {item.status === 'failed' && item.error ? (
                    <p className="text-caption text-destructive">{item.error}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusChip tone={BADGE[item.status] ?? 'neutral'}>
                    {copy.card.status[item.status] ?? item.status}
                  </StatusChip>
                  {item.status === 'proposed' ? (
                    <KitButton variant="pill" onClick={() => setReviewing(item.id)}>
                      {copy.activity.review}
                    </KitButton>
                  ) : null}
                  {item.canUndo ? (
                    <KitButton
                      variant="pill"
                      onClick={() => void handleUndo(item.id)}
                      disabled={undoing !== null}
                    >
                      {undoing === item.id ? (
                        <Spinner />
                      ) : (
                        <RotateCcw className="size-3.5" aria-hidden="true" />
                      )}
                      {copy.activity.undo}
                    </KitButton>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          {hasMore ? (
            <KitButton variant="link" onClick={() => setPage((p) => p + 1)} className="self-end">
              {copy.activity.more}
            </KitButton>
          ) : null}
        </div>
      )}
      <ApprovalDialog
        actionId={reviewing}
        onClose={() => setReviewing(null)}
        onChange={() => setPage(1)}
      />
    </DataCard>
  )
}
