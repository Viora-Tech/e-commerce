'use client'

import { Loader2Icon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { mediaContent } from '@/data/media'
import { api } from '@/lib/api-client'
import { extLabel, filenameFrom, formatMediaSize, type MediaItem } from './media-pick-types'
import MediaThumb from './media-thumb'

type MediaPickDetailsProps = {
  /** The file picked last; the pane is empty until something is picked. */
  item: MediaItem | null
  /** The new alt text is on the file now; the dialog updates its lists and the pick. */
  onAltSaved: (id: string, alt: string | null) => void
}

const copy = mediaContent.picker.details

/**
 * The picker's right pane: a larger preview of the file picked last, its name, type, size
 * and use, and its alt text, saved to the file itself so every product and section using
 * it reads the same description. Keyed by item id from the dialog, so the draft resets.
 */
export default function MediaPickDetails({ item, onAltSaved }: MediaPickDetailsProps) {
  // Hooks
  const fieldId = useId()
  const [alt, setAlt] = useState(item?.alt ?? '')
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async () => {
    if (!item) return
    setSaving(true)
    try {
      const next = alt.trim() || null
      await api.media.update({ id: item.id, alt: next })
      onAltSaved(item.id, next)
      toast.success(copy.saved)
    } catch {
      toast.error(copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Early returns
  if (!item) {
    return (
      <div className="flex h-full items-center justify-center p-5 text-center text-caption text-muted-foreground">
        {copy.empty}
      </div>
    )
  }

  // Render logic
  const name = filenameFrom(item.key) || item.alt || item.url.split('/').pop()?.split('?')[0]
  const meta = [extLabel(item), formatMediaSize(item.size)].filter(Boolean).join(' · ')
  const changed = (alt.trim() || null) !== (item.alt ?? null)

  return (
    <div className="flex flex-col gap-4 p-4">
      <h3 className="text-eyebrow text-muted-foreground">{copy.heading}</h3>
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-muted p-2">
        <MediaThumb item={item} className="object-contain" />
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <p className="truncate text-body-strong" title={name}>
          {name}
        </p>
        <p className="text-caption text-muted-foreground">
          {[meta, item.usedBy === undefined ? '' : copy.used(item.usedBy)]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId} className="text-caption font-medium text-foreground">
          {copy.alt}
        </label>
        <Textarea
          id={fieldId}
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder={copy.altPlaceholder}
          rows={3}
          aria-describedby={`${fieldId}-hint`}
        />
        <p id={`${fieldId}-hint`} className="text-caption text-muted-foreground">
          {copy.altHint}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!changed || saving}
        onClick={() => void handleSave()}
        className="self-start"
      >
        {saving ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
        {saving ? copy.saving : copy.save}
      </Button>
    </div>
  )
}
