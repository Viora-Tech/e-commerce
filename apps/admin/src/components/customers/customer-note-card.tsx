'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { customerDetailContent as copy } from '@/data/customers'
import { api } from '@/lib/api-client'

type NoteCardProps = {
  customerId: string
  note: string | null
  onChanged: () => void
}

/** One internal note per customer; saved explicitly. */
export default function CustomerNoteCard({ customerId, note, onChanged }: NoteCardProps) {
  // Hooks
  const [draft, setDraft] = useState(note ?? '')
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      await api.customers.update({ id: customerId, note: draft.trim() || null })
      toast.success(copy.note.saved)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const dirty = draft.trim() !== (note ?? '').trim()

  return (
    <DataCard title={copy.note.heading}>
      <div className="flex flex-col gap-2">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={copy.note.placeholder}
          rows={3}
        />
        {dirty ? (
          <div className="flex justify-end">
            <Button size="sm" variant="outline" onClick={handleSave} disabled={saving}>
              {copy.note.save}
            </Button>
          </div>
        ) : null}
      </div>
    </DataCard>
  )
}
