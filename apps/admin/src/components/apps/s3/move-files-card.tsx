'use client'

import { CircleAlert, CircleCheck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Progress } from '@commerce/ui/shadcn/progress'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import { appsContent } from '@/data/apps'
import { useCopy } from '@/hooks/use-copy'
import type { LoadFailure } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { isForbidden } from '@/lib/forbidden'

type Migration = Awaited<ReturnType<typeof api.store.storageMigrationStatus>>

type MoveFilesCardProps = {
  /** The storage provider id files are moved to, e.g. "s3". */
  targetProviderId: string
  /** Shown in the button and confirmation dialog, e.g. "Amazon S3". */
  targetLabel: string
}
const POLL_MS = 2000

/**
 * "Move existing files to <connection>": queues `migrateStorage` (see
 * `packages/core/src/media/migrate.ts`) and polls its progress. Safe to leave the page — the
 * job keeps running server-side and this card just picks the progress back up on return.
 */
export default function MoveFilesCard({ targetProviderId, targetLabel }: MoveFilesCardProps) {
  // Hooks
  const copy = useCopy(appsContent).storage.migrate
  const apps = useCopy(appsContent)
  const [migration, setMigration] = useState<Migration | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [starting, setStarting] = useState(false)
  /** The status read failed: say so with Try again, so a running move never reads as none. */
  const [statusFailed, setStatusFailed] = useState<LoadFailure | false>(false)
  const [attempt, setAttempt] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is Try again
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const poll = async () => {
      let status: Migration | null
      try {
        status = await api.store.storageMigrationStatus()
      } catch (err) {
        if (!cancelled) setStatusFailed(isForbidden(err) ? 'no-access' : 'error')
        return
      }
      if (cancelled) return
      setStatusFailed(false)
      setMigration(status)
      if (status?.status === 'running') timer = setTimeout(poll, POLL_MS)
    }
    void poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [attempt])

  // Event handlers
  const handleConfirm = async () => {
    setConfirmOpen(false)
    setStarting(true)
    try {
      await api.store.migrateStorage({ targetProviderId })
      toast.success(copy.started)
      setMigration({
        targetProviderId,
        status: 'running',
        total: 0,
        done: 0,
        failed: 0,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setTimeout(() => {
        void api.store.storageMigrationStatus().then(setMigration)
      }, POLL_MS)
    } catch (err) {
      toast.error(errorText(err, copy.failedToStart))
    } finally {
      setStarting(false)
    }
  }

  // Render logic
  const running = migration?.status === 'running'
  const relevant = migration?.targetProviderId === targetProviderId
  const pct =
    relevant && migration && migration.total > 0
      ? Math.round((migration.done / migration.total) * 100)
      : running
        ? 0
        : 100

  return (
    <DataCard
      title={copy.action(targetLabel)}
      subtitle={copy.confirmBody}
      bodyClassName="flex flex-col gap-3"
    >
      {relevant && migration ? (
        <div className="flex flex-col gap-2">
          <Progress value={pct} />
          {migration.status === 'running' ? (
            <p className="flex items-center gap-1.5 text-body text-muted-foreground">
              <Spinner className="size-4" />
              {migration.total > 0
                ? migration.failed > 0
                  ? copy.progressWithFailed(migration.done, migration.total, migration.failed)
                  : copy.progress(migration.done, migration.total)
                : copy.started}
            </p>
          ) : migration.status === 'done' ? (
            <p className="flex items-center gap-1.5 text-body font-medium text-success">
              <CircleCheck aria-hidden="true" className="size-4" />
              {copy.done}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-body font-medium text-destructive">
              <CircleAlert aria-hidden="true" className="size-4" />
              {copy.failed}
            </p>
          )}
        </div>
      ) : statusFailed ? (
        <LoadFailedState
          heading={apps.couldNotLoad.moveStatus}
          failed={statusFailed}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      ) : null}
      <div>
        <Button
          loading={starting}
          type="button"
          variant="outline"
          disabled={starting || running}
          onClick={() => setConfirmOpen(true)}
        >
          {copy.action(targetLabel)}
        </Button>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={copy.confirmTitle(targetLabel)}
        body={copy.confirmBody}
        confirmLabel={copy.confirm}
        cancelLabel={copy.cancel}
        tone="default"
        onConfirm={handleConfirm}
      />
    </DataCard>
  )
}
