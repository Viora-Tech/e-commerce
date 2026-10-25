'use client'

import { PIXEL_EVENTS, PURCHASE_TRIGGERS, triggerMayBeTooLate } from '@commerce/core/pixels'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Label } from '@commerce/ui/shadcn/label'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useState } from 'react'
import { toast } from 'sonner'
import PixelDialog from '@/components/apps/pixels/pixel-dialog'
import TokenDialog from '@/components/apps/pixels/token-dialog'
import CopyButton from '@/components/fields/copy-button'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import DataCard from '@/components/layout/data-card'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { pixelsContent } from '@/data/pixels'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Pixel = Awaited<ReturnType<typeof api.pixels.list>>[number]
type Trigger = (typeof PURCHASE_TRIGGERS)[number]
type EventName = (typeof PIXEL_EVENTS)[number]

type PixelCardProps = {
  pixel: Pixel
  onChanged: () => void
}

function chip(p: Pixel): { key: 'active' | 'browserOnly' | 'paused' | 'errored'; tone: ChipTone } {
  if (p.status === 'errored') return { key: 'errored', tone: 'danger' }
  if (p.status === 'paused') return { key: 'paused', tone: 'neutral' }
  return p.hasToken ? { key: 'active', tone: 'success' } : { key: 'browserOnly', tone: 'info' }
}

/** One Meta pixel: what it sends, when Purchase goes, its token and test code, and its actions. */
export default function PixelCard({ pixel, onChanged }: PixelCardProps) {
  // Hooks
  const copy = useCopy(pixelsContent)
  const [editing, setEditing] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [busy, setBusy] = useState(false)

  // Helpers
  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true)
    try {
      await fn()
      if (done) toast.success(done)
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleEvent = (name: EventName, on: boolean) => {
    const events = on ? [...pixel.events, name] : pixel.events.filter((e) => e !== name)
    void run(() => api.pixels.update({ id: pixel.id, events }), copy.card.saved)
  }
  const handleTrigger = (value: string) => {
    void run(
      () => api.pixels.update({ id: pixel.id, purchaseTrigger: value as Trigger }),
      copy.card.saved,
    )
  }
  const handleTest = async () => {
    setBusy(true)
    try {
      const r = await api.pixels.sendTest({ id: pixel.id })
      if (r.ok) toast.success(copy.card.testSent)
      else toast.error(copy.card.testFailed(r.message))
      onChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }
  const handlePause = () =>
    run(
      () =>
        api.pixels.setStatus({
          id: pixel.id,
          status: pixel.status === 'paused' ? 'active' : 'paused',
        }),
      pixel.status === 'paused' ? copy.card.resumed : copy.card.paused,
    )
  const handleClearToken = () =>
    run(() => api.pixels.clearToken({ id: pixel.id }), copy.card.tokenRemoved)
  const handleRemove = async () => {
    await api.pixels.remove({ id: pixel.id })
    toast.success(copy.card.removed)
    onChanged()
  }

  // Render logic
  const status = chip(pixel)
  const c = copy.card
  const menu = [
    {
      label: pixel.status === 'paused' ? c.resume : c.pause,
      onSelect: handlePause,
      hidden: pixel.status === 'errored',
    },
    { label: c.removeToken, onSelect: handleClearToken, hidden: !pixel.hasToken },
    { label: c.remove, onSelect: () => setRemoving(true), destructive: true },
  ]

  return (
    <DataCard
      title={
        <span className="flex items-center gap-2">
          {pixel.name || pixel.pixelId}
          <StatusChip tone={status.tone}>{copy.status[status.key]}</StatusChip>
        </span>
      }
      subtitle={
        <span className="flex items-center gap-1">
          {c.pixelId} {pixel.pixelId}
          <CopyButton value={pixel.pixelId} what={c.pixelId} visible />
        </span>
      }
      menu={menu}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={handleTest} disabled={busy || !pixel.hasToken}>
            {c.sendTest}
          </Button>
          <Button variant="outline" onClick={() => setEditing(true)}>
            {c.edit}
          </Button>
        </div>
      }
      bodyClassName="flex flex-col gap-4"
    >
      {pixel.status === 'errored' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-danger-soft px-4 py-3 text-body">
          <span>{c.errored}</span>
          <Button size="sm" variant="outline" onClick={() => setReplacing(true)}>
            {c.replaceToken}
          </Button>
        </div>
      ) : null}
      <dl className="grid gap-3 text-body sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <dt className="text-eyebrow text-muted-foreground">{c.lastEvent}</dt>
          <dd>{pixel.lastSentAt ? <RelativeTime value={pixel.lastSentAt} /> : c.never}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-eyebrow text-muted-foreground">{c.token}</dt>
          <dd className="flex items-center gap-2">
            {pixel.tokenHint ? c.tokenHint(pixel.tokenHint) : c.tokenNone}
            <Button size="sm" variant="ghost" onClick={() => setReplacing(true)}>
              {pixel.hasToken ? c.replaceToken : c.addToken}
            </Button>
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-eyebrow text-muted-foreground">{c.testCode}</dt>
          <dd>{pixel.testEventCode || c.testCodeNone}</dd>
        </div>
      </dl>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-eyebrow text-muted-foreground">{c.events}</legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {PIXEL_EVENTS.map((name) => (
            <div key={name} className="flex items-center gap-2">
              <Checkbox
                id={`${pixel.id}-${name}`}
                checked={pixel.events.includes(name)}
                disabled={busy}
                onCheckedChange={(on) => handleEvent(name, on === true)}
              />
              <Label htmlFor={`${pixel.id}-${name}`}>{copy.events[name]}</Label>
            </div>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${pixel.id}-trigger`}>{c.purchase}</Label>
        <NativeSelect
          id={`${pixel.id}-trigger`}
          className="w-full sm:w-80"
          value={pixel.purchaseTrigger}
          disabled={busy}
          onChange={(e) => handleTrigger(e.target.value)}
        >
          {PURCHASE_TRIGGERS.map((t) => (
            <NativeSelectOption key={t} value={t}>
              {copy.triggers[t]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {triggerMayBeTooLate(pixel.purchaseTrigger) ? (
          <p className="text-caption text-warning-foreground dark:text-warning">{c.lateWarning}</p>
        ) : null}
      </div>
      <PixelDialog open={editing} onOpenChange={setEditing} pixel={pixel} onSaved={onChanged} />
      <TokenDialog
        open={replacing}
        onOpenChange={setReplacing}
        pixelId={pixel.id}
        onSaved={onChanged}
      />
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={c.removeTitle}
        body={c.removeBody}
        confirmLabel={c.remove}
        cancelLabel={c.cancel}
        tone="destructive"
        onConfirm={handleRemove}
      />
    </DataCard>
  )
}
