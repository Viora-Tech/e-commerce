'use client'

import { Loader2Icon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type MediaFileAltProps = {
  id: string
  alt: string | null
  /** The new alt text is on the file now; the library updates the item in place. */
  onSaved: (id: string, alt: string | null) => void
}

/** The file page's Alt text card body. Keyed by file id from the page, so the draft resets. */
export default function MediaFileAlt({ id, alt, onSaved }: MediaFileAltProps) {
  // Hooks
  const { details: copy } = useCopy(mediaContent)
  const fieldId = useId()
  const [draft, setDraft] = useState(alt ?? '')
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      const next = draft.trim() || null
      await api.media.update({ id, alt: next })
      onSaved(id, next)
      toast.success(copy.saved)
    } catch {
      toast.error(copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const changed = (draft.trim() || null) !== (alt ?? null)

  return (
    <section className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="sr-only">
        {copy.alt}
      </label>
      <Textarea
        id={fieldId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={copy.altPlaceholder}
        maxLength={300}
        rows={3}
        aria-describedby={`${fieldId}-hint`}
      />
      <p id={`${fieldId}-hint`} className="text-caption text-muted-foreground">
        {copy.altHint}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!changed || saving}
        onClick={() => void handleSave()}
        className="self-end"
      >
        {saving ? <Loader2Icon className="size-4 animate-spin" aria-hidden="true" /> : null}
        {saving ? copy.saving : copy.saveAlt}
      </Button>
    </section>
  )
}
