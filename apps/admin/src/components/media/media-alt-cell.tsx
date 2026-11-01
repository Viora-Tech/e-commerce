'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { type KeyboardEvent, useState } from 'react'
import { toast } from 'sonner'
import { mediaContent } from '@/data/media'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type MediaAltCellProps = {
  id: string
  /** The file's display name, for the field's label. */
  name: string
  alt: string | null
  onSaved: (id: string, alt: string | null) => void
}

/**
 * The list view's alt text column (#91), edited in place: saves on Enter or when the field loses
 * focus; Escape puts the saved text back. Sits above the row's link so a click edits.
 */
export default function MediaAltCell({ id, name, alt, onSaved }: MediaAltCellProps) {
  // Hooks
  const { library: copy } = useCopy(mediaContent)
  const [draft, setDraft] = useState(alt ?? '')
  const [saving, setSaving] = useState(false)

  // Helpers
  const save = async () => {
    const next = draft.trim() || null
    if (next === (alt ?? null)) return
    setSaving(true)
    try {
      await api.media.update({ id, alt: next })
      onSaved(id, next)
      toast.success(copy.altSaved)
    } catch {
      setDraft(alt ?? '')
      toast.error(copy.altFailed)
    } finally {
      setSaving(false)
    }
  }

  // Event handlers
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.currentTarget.blur()
    }
    // Puts the saved text back; leaving the field then has nothing to save.
    if (e.key === 'Escape') setDraft(alt ?? '')
  }

  return (
    <Input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void save()}
      onKeyDown={handleKeyDown}
      placeholder={copy.altEmpty}
      aria-label={copy.altEdit(name)}
      maxLength={300}
      disabled={saving}
      className="relative z-20 w-full"
    />
  )
}
