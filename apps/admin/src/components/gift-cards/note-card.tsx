'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { giftCardDetailContent } from '@/data/gift-cards'
import { api } from '@/lib/api-client'

type NoteCardProps = {
  card: { id: string; note: string | null }
  onChanged: () => Promise<void>
}

const copy = giftCardDetailContent.note

/** Staff-only note; the save button appears once the text changes. */
export default function NoteCard({ card, onChanged }: NoteCardProps) {
  // Hooks
  const [value, setValue] = useState(card.note ?? '')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleSave = async () => {
    setBusy(true)
    try {
      await api.giftCards.update({ id: card.id, note: value.trim() || null })
      toast.success(copy.saved)
      await onChanged()
    } catch {
      toast.error(giftCardDetailContent.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const dirty = value.trim() !== (card.note ?? '')

  return (
    <DataCard title={copy.heading}>
      <div className="flex flex-col gap-3">
        <Textarea
          rows={3}
          value={value}
          placeholder={copy.placeholder}
          onChange={(e) => setValue(e.target.value)}
        />
        {dirty ? (
          <Button size="sm" className="self-end" onClick={handleSave} disabled={busy}>
            {copy.save}
          </Button>
        ) : null}
      </div>
    </DataCard>
  )
}
