'use client'

import { X } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { type KeyboardEvent, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type TagsCardProps = {
  orderId: string
  tags: string[]
  onChanged: () => void
}

/** Free-form labels for filtering later; saved on every add/remove. */
export default function TagsCard({ orderId, tags, onChanged }: TagsCardProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async (next: string[]) => {
    setSaving(true)
    try {
      await api.orders.setTags({ id: orderId, tags: next })
      toast.success(copy.tags.saved)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const tag = draft.trim()
    if (!tag || tags.includes(tag)) return
    setDraft('')
    void handleSave([...tags, tag])
  }

  return (
    <DataCard title={copy.tags.heading} className="print:hidden">
      <div className="flex flex-col gap-3">
        {tags.length > 0 ? (
          // The tag chips of every tag field (`fields/tag-input.tsx`): a neutral chip with an ×.
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <li key={t}>
                <StatusChip dot={false} className="pr-1">
                  {t}
                  <button
                    type="button"
                    onClick={() => handleSave(tags.filter((x) => x !== t))}
                    disabled={saving}
                    className="rounded-sm opacity-60 hover:opacity-100 disabled:opacity-30"
                    aria-label={copy.tags.remove(t)}
                  >
                    <X className="size-3" />
                  </button>
                </StatusChip>
              </li>
            ))}
          </ul>
        ) : null}
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={copy.tags.placeholder}
          disabled={saving}
        />
      </div>
    </DataCard>
  )
}
