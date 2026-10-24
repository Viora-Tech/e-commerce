'use client'

import type { ChannelState, SalesChannelId } from '@commerce/core/sales-channels'
import { Pause, Play, RefreshCw, Unlink } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type ManageChannelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  channel: SalesChannelId
  name: string
  state: ChannelState
}

/** A connected channel: its account and last sync, then Sync now, Pause or Resume, Disconnect. */
export default function ManageChannelDialog({
  open,
  onOpenChange,
  channel,
  name,
  state,
}: ManageChannelDialogProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent.live)
  const format = useFormat()
  const router = useRouter()
  const [busy, setBusy] = useState<'sync' | 'pause' | 'disconnect' | null>(null)
  const [confirming, setConfirming] = useState(false)

  // Event handlers
  const run = async (kind: 'sync' | 'pause' | 'disconnect', work: () => Promise<string>) => {
    setBusy(kind)
    try {
      toast.success(await work())
      onOpenChange(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(null)
      setConfirming(false)
    }
  }

  const handleSync = () =>
    run('sync', async () => {
      await api.salesChannels.syncNow({ channel })
      return copy.syncQueued
    })

  const handlePause = () =>
    run('pause', async () => {
      const paused = state.status !== 'paused'
      await api.salesChannels.pause({ channel, paused })
      return paused ? copy.paused(name) : copy.resumed(name)
    })

  const handleDisconnect = () =>
    run('disconnect', async () => {
      await api.salesChannels.disconnect({ channel })
      return copy.disconnected(name)
    })

  // Render logic
  const last = state.sync.lastTriedAt
  const syncing = state.status === 'syncing' || state.status === 'first_sync'
  const rows = [
    [copy.account, state.account ?? '—'],
    [copy.lastSync, syncing ? copy.syncingNow : last ? format.ago(last) : copy.never],
    [copy.items, state.sync.sent != null ? format.number(state.sync.sent) : '—'],
  ]

  return (
    <>
      <Dialog open={open && !confirming} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{copy.title(name)}</DialogTitle>
            <DialogDescription className="sr-only">{copy.title(name)}</DialogDescription>
          </DialogHeader>
          <dl className="flex flex-col divide-y divide-border text-body">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 py-2">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
          {state.sync.message ? (
            <p className="text-caption text-danger">{state.sync.message}</p>
          ) : null}
          <DialogFooter className="flex-row flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
            <Button
              variant="outline"
              className="text-danger"
              onClick={() => setConfirming(true)}
              disabled={busy !== null}
            >
              <Unlink aria-hidden="true" />
              {copy.disconnect}
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handlePause}
                loading={busy === 'pause'}
                disabled={busy !== null}
              >
                {state.status === 'paused' ? (
                  <Play aria-hidden="true" />
                ) : (
                  <Pause aria-hidden="true" />
                )}
                {state.status === 'paused' ? copy.resume : copy.pause}
              </Button>
              <Button
                onClick={handleSync}
                loading={busy === 'sync'}
                disabled={busy !== null || state.status === 'paused' || syncing}
              >
                <RefreshCw aria-hidden="true" />
                {copy.syncNow}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={copy.disconnectTitle(name)}
        body={copy.disconnectBody(name)}
        confirmLabel={copy.disconnect}
        tone="destructive"
        busy={busy === 'disconnect'}
        onConfirm={handleDisconnect}
      />
    </>
  )
}
