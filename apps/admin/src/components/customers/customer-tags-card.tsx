'use client'

import { X } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { type KeyboardEvent, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type TagsCardProps = {
  customerId: string
  tags: string[]
  onChanged: () => void
}

/** Free-form labels, saved on every add/remove (same pattern as order tags). */
export default function CustomerTagsCard({ customerId, tags, onChanged }: TagsCardProps) {
  // Hooks
  const copy = useCopy(customerDetailContent)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  // Event handlers
  const handleSave = async (next: string[]) => {
    setSaving(true)
    try {
      await api.customers.update({ id: customerId, tags: next })
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
    <DataCard title={copy.tags.heading} className="rounded-xl">
      <div className="flex flex-col gap-3">
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <li
                key={t}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-hairline bg-chip-neutral pr-1 pl-2 text-caption text-foreground"
              >
                {t}
                <button
                  type="button"
                  onClick={() => handleSave(tags.filter((x) => x !== t))}
                  disabled={saving}
                  className="rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label={copy.tags.remove(t)}
                >
                  <X className="size-3" />
                </button>
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
