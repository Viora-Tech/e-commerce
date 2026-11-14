'use client'

import { X } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { type KeyboardEvent, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { customerDetailContent } from '@/data/customers'
import { useCopy } from '@/hooks/use-copy'

type TagsCardProps = {
  tags: string[]
  onChange: (tags: string[]) => void
}

/** Free-form labels; the page's save bar saves them with the other edits. */
export default function CustomerTagsCard({ tags, onChange }: TagsCardProps) {
  // Hooks
  const copy = useCopy(customerDetailContent)
  const [draft, setDraft] = useState('')

  // Event handlers
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const tag = draft.trim()
    if (!tag || tags.includes(tag)) return
    setDraft('')
    onChange([...tags, tag])
  }

  return (
    <DataCard title={copy.tags.heading}>
      <div className="flex flex-col gap-3">
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <li key={t}>
                {/* The one chip, as the product tags draw it. */}
                <StatusChip dot={false} className="pr-1">
                  {t}
                  <button
                    type="button"
                    onClick={() => onChange(tags.filter((x) => x !== t))}
                    className="rounded-sm opacity-60 hover:opacity-100"
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
        />
      </div>
    </DataCard>
  )
}
