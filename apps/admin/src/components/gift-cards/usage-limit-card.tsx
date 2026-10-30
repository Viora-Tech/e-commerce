'use client'

import { Pencil, Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { giftCardDetailContent } from '@/data/gift-cards'
import { api } from '@/lib/api-client'

type UsageLimitCardProps = {
  card: { id: string; usageLimit: number | null; useCount: number }
  onChanged: () => Promise<void>
}

const copy = giftCardDetailContent.usage

/** How many checkouts may spend the card, with inline edit (#993); no limit by default. */
export default function UsageLimitCard({ card, onChanged }: UsageLimitCardProps) {
  // Hooks
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(card.usageLimit ? String(card.usageLimit) : '')
  const [busy, setBusy] = useState(false)

  // Helpers
  const save = async (usageLimit: number | null) => {
    setBusy(true)
    try {
      await api.giftCards.update({ id: card.id, usageLimit })
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
    setValue(card.usageLimit ? String(card.usageLimit) : '')
    setEditing(true)
  }

  // Render logic
  const limit = Number(value)
  const valid = Number.isInteger(limit) && limit >= 1 && limit <= 100000

  return (
    <DataCard
      title={copy.heading}
      action={
        editing ? null : (
          <Button variant="ghost" size="sm" onClick={handleEdit}>
            <Pencil aria-hidden="true" />
            {copy.edit}
          </Button>
        )
      }
    >
      {editing ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5 text-body">
            <label htmlFor={`usage-limit-${card.id}`}>{copy.label}</label>
            <Input
              id={`usage-limit-${card.id}`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <span className="text-caption text-muted-foreground">{copy.help}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => save(limit)} disabled={busy || !valid}>
              <Save aria-hidden="true" />
              {copy.save}
            </Button>
            {card.usageLimit !== null ? (
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
        <div className="flex flex-col gap-0.5">
          <p className="text-body text-foreground">
            {card.usageLimit === null ? copy.none : copy.used(card.useCount, card.usageLimit)}
          </p>
          {card.usageLimit === null && card.useCount > 0 ? (
            <p className="text-caption text-muted-foreground">{copy.used(card.useCount, null)}</p>
          ) : null}
        </div>
      )}
    </DataCard>
  )
}
