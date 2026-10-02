'use client'

import { AiIcon } from '@commerce/ui/icons'
import { Progress } from '@commerce/ui/shadcn/progress'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import KitButton from '@/components/kit/kit-button'
import { assistantContent } from '@/data/assistant'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Summary = Awaited<ReturnType<typeof api.ai.bulkJobs>>[number]

type BulkWriteBannerProps = {
  /** Bumped when a run starts or is applied, so the banner looks again. */
  refreshKey: number
  onOpen: (jobId: string) => void
}

const POLL_MS = 3_000

function loadLatest(): Promise<Summary | null> {
  return api.ai
    .bulkJobs()
    .then((jobs) => jobs[0] ?? null)
    .catch(() => null)
}

function isLive(job: Summary | null): boolean {
  return job?.status === 'queued' || job?.status === 'running'
}

/** Above the products list: a bulk AI run still writing, or suggestions waiting for review. */
export default function BulkWriteBanner({ refreshKey, onOpen }: BulkWriteBannerProps) {
  // Hooks
  const copy = useCopy(assistantContent)
  const [latest, setLatest] = useState<Summary | null>(null)

  useEffect(() => {
    if (refreshKey < 0) return
    loadLatest().then(setLatest)
  }, [refreshKey])

  // While a run writes, look again every few seconds; each answer schedules the next look.
  useEffect(() => {
    if (!isLive(latest)) return
    const timer = setTimeout(() => void loadLatest().then(setLatest), POLL_MS)
    return () => clearTimeout(timer)
  }, [latest])

  // Early returns
  const live = isLive(latest)
  if (!latest || (!live && latest.ready === 0)) return null

  // Render logic
  const finished = latest.done + latest.failed

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
        {live ? (
          <Spinner className="text-primary" />
        ) : (
          <AiIcon className="size-4 text-primary" aria-hidden="true" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="text-body font-medium text-ink-strong">
          {live ? copy.bulk.banner(finished, latest.total) : copy.bulk.bannerReady(latest.ready)}
        </p>
        {live ? (
          <Progress
            value={latest.total ? (finished / latest.total) * 100 : 0}
            className="max-w-sm"
          />
        ) : null}
      </div>
      <KitButton variant="secondary" onClick={() => onOpen(latest.id)}>
        {copy.bulk.view}
      </KitButton>
    </div>
  )
}
