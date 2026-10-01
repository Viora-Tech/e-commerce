'use client'

import { dayStart } from '@commerce/dates'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import { giftCardDetailContent } from '@/data/gift-cards'
import { api } from '@/lib/api-client'
import { formatPattern } from '@/lib/format-date'

type ExpiryCardProps = {
  card: { id: string; expiresOn: string | null; today: string }
  onChanged: () => Promise<void>
}

const copy = giftCardDetailContent.expiry

/** Expiry date with inline edit; clearing it makes the card never expire. */
export default function ExpiryCard({ card, onChanged }: ExpiryCardProps) {
  // Hooks
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(card.expiresOn ?? '')
  const [busy, setBusy] = useState(false)

  // Helpers
  const save = async (expiresOn: string | null) => {
    setBusy(true)
    try {
      await api.giftCards.update({ id: card.id, expiresOn })
      toast.success(copy.saved)
      setEditing(false)
      await onChanged()
    } catch {
      toast.error(giftCardDetailContent.failed)
    } finally {
      setBusy(false)
    }
  }

  // Event handlers
  const handleEdit = () => {
    setValue(card.expiresOn ?? '')
    setEditing(true)
  }

  // Render logic
  const label = card.expiresOn
    ? copy.on(
        formatPattern(dayStart(card.expiresOn), { day: 'numeric', month: 'long', year: 'numeric' }),
      )
    : copy.never

  return (
    <Card className="gap-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-card-title text-foreground">{copy.heading}</p>
        {editing ? null : (
          <Button variant="ghost" size="sm" onClick={handleEdit}>
            {copy.edit}
          </Button>
        )}
      </div>
      {editing ? (
        <div className="flex flex-col gap-3">
          <Input
            type="date"
            min={card.today}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => save(value || null)} disabled={busy || !value}>
              {copy.save}
            </Button>
            {card.expiresOn ? (
              <Button size="sm" variant="outline" onClick={() => save(null)} disabled={busy}>
                {copy.remove}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
              {copy.cancel}
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-body text-foreground">{label}</p>
      )}
    </Card>
  )
}
