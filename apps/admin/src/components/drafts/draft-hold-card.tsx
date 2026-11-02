'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { draftEditorContent } from '@/data/drafts'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type DraftHoldCardProps = {
  /** The saved draft; null until it is first saved. */
  draftId: string | null
  /** Unsaved edits: the hold covers the saved lines, so save first. */
  dirty: boolean
  /** When the saved draft's hold runs out; null when nothing is held. */
  heldUntil: Date | null
}

/** End of the chosen day in the browser's time zone, as the API's ISO datetime. */
function endOfDay(day: string): string {
  return new Date(`${day}T23:59:59`).toISOString()
}

/**
 * "Reserve items" (#1030): hold the draft's stock until a date so no one else can buy it.
 * Converting or deleting the draft, or the date passing, gives it back.
 */
export default function DraftHoldCard({ draftId, dirty, heldUntil }: DraftHoldCardProps) {
  // Hooks
  const { hold: copy } = useCopy(draftEditorContent)
  const fmt = useFormat()
  const [until, setUntil] = useState<Date | null>(heldUntil)
  const [day, setDay] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleReserve = async () => {
    if (!draftId || !day) return
    setBusy(true)
    try {
      const r = await api.orders.reserveDraft({ id: draftId, until: endOfDay(day) })
      setUntil(new Date(r.reservedUntil))
      setDay('')
      toast.success(copy.reserved)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleRelease = async () => {
    if (!draftId) return
    setBusy(true)
    try {
      await api.orders.releaseDraft({ id: draftId })
      setUntil(null)
      toast.success(copy.released)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const blocked = !draftId || dirty
  return (
    <DataCard title={copy.heading} bodyClassName="flex flex-col gap-3">
      <p className="text-caption text-muted-foreground">{copy.body}</p>
      {until ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-body">{copy.heldUntil(fmt.date(until))}</p>
          <Button variant="outline" size="sm" disabled={busy} onClick={handleRelease}>
            {copy.release}
          </Button>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <Field className="flex-1">
            <FieldLabel htmlFor="draft-hold-until">{copy.until}</FieldLabel>
            <Input
              id="draft-hold-until"
              type="date"
              value={day}
              disabled={blocked}
              onChange={(e) => setDay(e.target.value)}
            />
          </Field>
          <Button
            variant="outline"
            disabled={blocked || !day || busy}
            onClick={handleReserve}
            title={blocked ? copy.saveFirst : undefined}
          >
            {copy.reserve}
          </Button>
        </div>
      )}
      {blocked && !until ? (
        <p className="text-caption text-muted-foreground">{copy.saveFirst}</p>
      ) : null}
    </DataCard>
  )
}
