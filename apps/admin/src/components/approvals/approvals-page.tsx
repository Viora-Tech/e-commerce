'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import ActionCard from '@/components/assistant/action-card'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import SettingsDrill from '@/components/settings/settings-drill'
import SettingsDrillPanel from '@/components/settings/settings-drill-panel'
import { approvalsContent } from '@/data/approvals'
import { settingsRowsContent } from '@/data/settings-rows'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Item = Awaited<ReturnType<typeof api.approvals.waiting>>[number]

/**
 * Settings → Approvals, Shopify-style (#147): a row each for changes waiting for this member's approval (Reject left, Approve
 * right, expired ones marked), and the member's own requests with what became of them.
 * Each row opens in place (`?open=`). Opening the page marks the member's decided requests
 * seen, which clears the outcome badge.
 */
export default function ApprovalsPage() {
  // Hooks
  const copy = useCopy(approvalsContent)
  const rowsCopy = useCopy(settingsRowsContent)
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

  // Render logic
  const rows = [
    {
      id: 'waiting',
      title: copy.waiting.heading,
      value: waiting ? rowsCopy.approvals.waitingValue(waiting.length) : '',
    },
    {
      id: 'mine',
      title: copy.mine.heading,
      value: mine ? rowsCopy.approvals.mineValue(mine.length) : '',
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.intro} />
      {failed ? (
        <p className="text-body text-muted-foreground">{copy.failed}</p>
      ) : (
        <SettingsDrill rows={rows} backLabel={copy.title}>
          <SettingsDrillPanel id="waiting">
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
          </SettingsDrillPanel>
          <SettingsDrillPanel id="mine">
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
          </SettingsDrillPanel>
        </SettingsDrill>
      )}
    </div>
  )
}
