'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import { gstSeriesNextContent } from '@/data/gst-invoices'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type SeriesNextFieldProps = {
  seriesId: string
  /** False for a series added on this screen and not saved yet: the server does not know it. */
  saved: boolean
  /** Reload the "Next:" previews after the counter moved. */
  onSet: () => void
}

function parseWanted(draft: string): number | null {
  const n = Number(draft.trim())
  return draft.trim() !== '' && Number.isInteger(n) && n >= 1 ? n : null
}

/**
 * One series' next number, set on the spot (not with the settings Save): the counter is
 * shared with issuing, and the server refuses a number already used this financial year.
 */
export default function SeriesNextField({ seriesId, saved, onSet }: SeriesNextFieldProps) {
  // Hooks
  const copy = useCopy(gstSeriesNextContent)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleSet = async () => {
    const wanted = parseWanted(draft)
    if (wanted === null) return
    setBusy(true)
    setError(null)
    try {
      const r = await api.gstInvoices.series.setNext({ seriesId, nextNumber: wanted })
      toast.success(copy.saved(r?.number ?? String(wanted)))
      setDraft('')
      onSet()
    } catch (err) {
      setError(errorText(err, copy.failed))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const id = `series-next-${seriesId}`
  const canSet = saved && !busy && parseWanted(draft) !== null

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{copy.label}</FieldLabel>
      <div className="flex gap-2">
        <Input
          size="lg"
          id={id}
          className="w-32"
          value={draft}
          inputMode="numeric"
          maxLength={8}
          placeholder={copy.placeholder}
          disabled={!saved || busy}
          aria-invalid={error ? true : undefined}
          onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, ''))}
        />
        <Button variant="outline" size="lg" disabled={!canSet} onClick={handleSet}>
          {busy ? copy.setting : copy.set}
        </Button>
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
      {!error ? <FieldDescription>{saved ? copy.help : copy.unsaved}</FieldDescription> : null}
    </Field>
  )
}
