'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import ActionCard from '@/components/assistant/action-card'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import { approvalsContent } from '@/data/approvals'
import { SETTINGS_BACK } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Item = Awaited<ReturnType<typeof api.approvals.waiting>>[number]

/**
 * Settings → Approvals: changes waiting for this member's approval (Reject left, Approve
 * right, expired ones marked), and the member's own requests with what became of them.
 * Opening it marks the member's decided requests seen, which clears the outcome badge.
 */
export default function ApprovalsPage() {
  // Hooks
  const copy = useCopy(approvalsContent)
  const [waiting, setWaiting] = useState<Item[] | null>(null)
  const [mine, setMine] = useState<Item[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    Promise.all([api.approvals.waiting(), api.approvals.mine()])
      .then(([w, m]) => {
        setWaiting(w)
        setMine(m)
      })
      .catch(() => setFailed(true))
  }, [])

  // Helpers
  const replace = (list: Item[] | null, view: Item) =>
    (list ?? []).map((i) => (i.id === view.id ? view : i))

  // Event handlers
  const handleWaitingChange = (view: Item) => setWaiting((all) => replace(all, view))
  const handleMineChange = (view: Item) => setMine((all) => replace(all, view))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.intro} back={SETTINGS_BACK} />
      {failed ? (
        <p className="text-body text-muted-foreground">{copy.failed}</p>
      ) : (
        <>
          <DataCard title={copy.waiting.heading} subtitle={copy.waiting.help}>
            {waiting === null ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : waiting.length === 0 ? (
              <EmptyState variant="dashed" size="sm" body={copy.waiting.empty} />
            ) : (
              <ul className="flex flex-col gap-3">
                {waiting.map((item) => (
                  <li key={item.id}>
                    <ActionCard action={item} onChange={handleWaitingChange} />
                  </li>
                ))}
              </ul>
            )}
          </DataCard>
          <DataCard title={copy.mine.heading} subtitle={copy.mine.help}>
            {mine === null ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : mine.length === 0 ? (
              <EmptyState variant="dashed" size="sm" body={copy.mine.empty} />
            ) : (
              <ul className="flex flex-col gap-3">
                {mine.map((item) => (
                  <li key={item.id}>
                    <ActionCard action={item} onChange={handleMineChange} />
                  </li>
                ))}
              </ul>
            )}
          </DataCard>
        </>
      )}
    </div>
  )
}
