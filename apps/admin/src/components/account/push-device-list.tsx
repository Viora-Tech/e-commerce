'use client'

import { Monitor, Smartphone, Tablet, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import StatusChip from '@/components/layout/status-chip'
import { accountContent } from '@/data/account'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { deviceName } from '@/lib/device-label'

type PushDeviceRow = Awaited<ReturnType<typeof api.account.pushDevices>>[number]

type PushDeviceListProps = {
  /** This browser's push endpoint while it has one, so its row says "This device". */
  endpoint: string | null
  /** False while this browser's push state is still being read; the list waits for it. */
  ready: boolean
  /** Bumped by the card after Turn on or Turn off, to load the list again. */
  version: number
  /** The member's device count after a Remove. */
  onDevices: (devices: number) => void
}

const KIND_ICON = { phone: Smartphone, tablet: Tablet, computer: Monitor } as const

/**
 * Account → Notifications, "Devices with push on": every phone or computer the member gets
 * pushes on in this store, this one marked, each other one with Remove (asks first). Removing
 * deletes the saved subscription, so that device gets no more pushes.
 */
export default function PushDeviceList({
  endpoint,
  ready,
  version,
  onDevices,
}: PushDeviceListProps) {
  // Hooks
  const content = useCopy(accountContent)
  const fmt = useFormat()
  const [rows, setRows] = useState<PushDeviceRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [reload, setReload] = useState(0)
  const [target, setTarget] = useState<PushDeviceRow | null>(null)
  const [busy, setBusy] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` and `reload` re-run the load after a change
  useEffect(() => {
    if (!ready) return
    let live = true
    api.account
      .pushDevices({ endpoint })
      .then((r) => {
        if (!live) return
        setRows(r)
        setFailed(false)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [ready, endpoint, version, reload])

  // Event handlers
  const handleRemove = async () => {
    if (!target) return
    setBusy(true)
    try {
      const r = await api.account.removePushDeviceById({ id: target.id })
      onDevices(r.devices)
      toast.success(copy.removed)
      setTarget(null)
      setReload((n) => n + 1)
    } catch (err) {
      toast.error(errorText(err, copy.removeFailed))
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  const copy = content.notifications.push.list
  if (failed) return <p className="text-caption text-muted-foreground">{copy.loadFailed}</p>
  if (rows === null) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-10 w-full" />
      </div>
    )
  }

  // Render logic
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-body font-semibold text-ink-strong">{copy.heading}</span>
        <span className="text-caption text-muted-foreground">{copy.body}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-caption text-muted-foreground">{copy.empty}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const Icon = KIND_ICON[row.device.kind]
            const meta = [
              copy.added(fmt.date(row.createdAt)),
              row.lastOkAt ? copy.lastPush(fmt.when(row.lastOkAt)) : null,
            ].filter(Boolean)
            return (
              <li key={row.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Icon aria-hidden="true" className="size-5 shrink-0 text-ink-strong" />
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="truncate text-body font-medium text-ink-strong">
                        {deviceName(row.device, content)}
                      </span>
                      {row.thisDevice ? <StatusChip>{copy.thisDevice}</StatusChip> : null}
                    </div>
                    <span className="truncate text-caption text-muted-foreground">
                      {meta.join(' · ')}
                    </span>
                  </div>
                </div>
                {row.thisDevice ? null : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start sm:self-auto"
                    onClick={() => setTarget(row)}
                  >
                    <Trash2 aria-hidden="true" />
                    {copy.remove}
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <ConfirmDialog
        tone="destructive"
        open={target !== null}
        title={copy.dialog.title(target ? deviceName(target.device, content) : '')}
        body={copy.dialog.body}
        confirmLabel={copy.dialog.confirm}
        cancelLabel={copy.dialog.cancel}
        busy={busy}
        onOpenChange={(open) => !open && !busy && setTarget(null)}
        onConfirm={handleRemove}
      />
    </div>
  )
}
