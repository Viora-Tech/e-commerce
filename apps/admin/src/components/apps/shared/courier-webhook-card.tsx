'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: CourierWebhookCard
 * WHAT:  the "Tracking webhook URL" card of a courier's Overview: this store's own address to
 *        paste into the courier, with a copy button.
 * WHY:   Figma "Delhivery · Overview"; the address carries the store id, so it is built here.
 * WHERE: the `footer` of ProviderOverviewPage for couriers that push tracking (Delhivery, Shiprocket).
 */

import { courierWebhookPath } from '@commerce/core/courier-webhook-path'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import LoadFailedState from './load-failed-state'

type CourierWebhookCardProps = {
  providerId: string
  title: string
  /** Where to paste it, shown over the address. */
  where: string
  help: string
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'

export default function CourierWebhookCard({
  providerId,
  title,
  where,
  help,
}: CourierWebhookCardProps) {
  // Hooks
  const apps = useCopy(appsContent)
  const [storeId, setStoreId] = useState<string | null>(null)
  /** The store read failed: Try again instead of a bar that never fills. */
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is Try again
  useEffect(() => {
    setFailed(false)
    api.store
      .current()
      .then((s) => setStoreId(s?.id ?? null))
      .catch(() => {
        setStoreId(null)
        setFailed(true)
      })
  }, [attempt])

  // Render logic
  // Shiprocket gets the neutral alias (its form refuses a URL naming it); others the named path.
  const url = storeId ? `${WORKER_URL}${courierWebhookPath(providerId, storeId)}` : null

  return (
    <DataCard title={title}>
      <div className="flex flex-col gap-3">
        {failed ? (
          <LoadFailedState
            heading={apps.couldNotLoad.details}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        ) : url ? (
          <KeyValueList rows={[{ label: where, value: url, copy: true }]} />
        ) : (
          <Skeleton className="h-10 w-full" />
        )}
        <p className="text-caption text-muted-foreground">{help}</p>
      </div>
    </DataCard>
  )
}
