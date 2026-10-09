'use client'

import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import SaveBar from '@/components/layout/save-bar'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type NoteCardProps = {
  customerId: string
  note: string | null
  onChanged: () => void
}

/** One internal note per customer; edits wait on the floating save bar until saved or discarded. */
export default function CustomerNoteCard({ customerId, note, onChanged }: NoteCardProps) {
  // Hooks
  const detail = useCopy(customerDetailContent)
  const [draft, setDraft] = useState(note ?? '')
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.customers.update({ id: customerId, note: draft.trim() || null })
      toast.success(detail.note.saved)
      onChanged()
    } catch {
      toast.error(detail.note.failed)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => setDraft(note ?? '')

  // Render logic
  const copy = detail.note
  const dirty = draft.trim() !== (note ?? '').trim()

  return (
    <DataCard title={copy.heading} className="rounded-xl">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={copy.placeholder}
        rows={3}
        aria-label={copy.heading}
      />
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={saving}
      />
    </DataCard>
  )
}
