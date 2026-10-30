'use client'

import type { RolloutView } from '@commerce/core'
import { Archive, Pause, Play, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ActionMenu from '@/components/layout/action-menu'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import RolloutEndDialog from './rollout-end-dialog'

type RolloutActionsProps = {
  rollout: RolloutView
  /** Unsaved edits: starting would run the saved version, so Start waits for Save. */
  dirty: boolean
}

type Confirming = 'start' | 'pause' | 'delete' | null

/** The rollout page's header actions: start now, pause or resume, end now, archive, delete. */
export default function RolloutActions({ rollout: r, dirty }: RolloutActionsProps) {
  // Hooks
  const { form: copy } = useCopy(rolloutsContent)
  const router = useRouter()
  const [confirming, setConfirming] = useState<Confirming>(null)
  const [ending, setEnding] = useState(false)
  const [busy, setBusy] = useState(false)

  // Helpers
  const run = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true)
    try {
      await work()
      toast.success(done)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.toasts.failed)
      throw err
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleStart = () => run(() => api.rollouts.startNow({ id: r.id }), copy.toasts.started)
  const handlePause = () => run(() => api.rollouts.pause({ id: r.id }), copy.toasts.paused)
  const handleResume = () =>
    run(() => api.rollouts.resume({ id: r.id }), copy.toasts.resumed).catch(() => undefined)
  const handleEnd = (action: RolloutView['endAction']) =>
    run(() => api.rollouts.end({ id: r.id, action }), copy.toasts.ended).then(() =>
      setEnding(false),
    )
  const handleArchive = () =>
    run(() => api.rollouts.archive({ id: r.id }), copy.toasts.archived).catch(() => undefined)
  const handleDelete = async () => {
    await run(() => api.rollouts.delete({ id: r.id }), copy.toasts.deleted)
    router.push(routes.rollouts.list())
  }

  // Render logic
  const canStart = r.status === 'draft' || r.status === 'scheduled'
  const running = r.status === 'active' || r.status === 'paused'
  const isEventRunning = running && r.kind === 'event'

  return (
    <>
      {r.status === 'active' ? null : (
        <ActionMenu
          label={copy.actions.label}
          trigger="kebab"
          variant="outline"
          size="md"
          disabled={busy}
          items={[
            {
              label: copy.actions.archive,
              icon: Archive,
              hidden: r.status === 'archived',
              onSelect: handleArchive,
            },
            {
              label: copy.actions.delete,
              icon: Trash2,
              destructive: true,
              onSelect: () => setConfirming('delete'),
            },
          ]}
        />
      )}
      {r.status === 'active' && r.kind === 'event' ? (
        <Button variant="outline" disabled={busy} onClick={() => setConfirming('pause')}>
          <Pause aria-hidden="true" />
          {copy.actions.pause}
        </Button>
      ) : null}
      {r.status === 'paused' ? (
        <Button variant="outline" disabled={busy} onClick={handleResume}>
          <Play aria-hidden="true" />
          {copy.actions.resume}
        </Button>
      ) : null}
      {isEventRunning ? (
        <Button disabled={busy} onClick={() => setEnding(true)}>
          {copy.actions.end}
        </Button>
      ) : null}
      {canStart ? (
        <Button
          variant="outline"
          disabled={busy || dirty || r.changes.length === 0}
          onClick={() => setConfirming('start')}
        >
          <Play aria-hidden="true" />
          {copy.actions.startNow}
        </Button>
      ) : null}

      <ConfirmDialog
        open={confirming === 'start'}
        onOpenChange={(open) => setConfirming(open ? 'start' : null)}
        title={copy.confirmStart.title(r.name)}
        body={copy.confirmStart.body}
        confirmLabel={copy.confirmStart.confirm}
        onConfirm={handleStart}
      />
      <ConfirmDialog
        open={confirming === 'pause'}
        onOpenChange={(open) => setConfirming(open ? 'pause' : null)}
        title={copy.confirmPause.title(r.name)}
        body={copy.confirmPause.body}
        confirmLabel={copy.confirmPause.confirm}
        onConfirm={handlePause}
      />
      <ConfirmDialog
        open={confirming === 'delete'}
        onOpenChange={(open) => setConfirming(open ? 'delete' : null)}
        title={copy.confirmDelete.title(r.name)}
        body={copy.confirmDelete.body}
        confirmLabel={copy.confirmDelete.confirm}
        tone="destructive"
        onConfirm={handleDelete}
      />
      {ending ? (
        <RolloutEndDialog rollout={r} onClose={() => setEnding(false)} onEnd={handleEnd} />
      ) : null}
    </>
  )
}
