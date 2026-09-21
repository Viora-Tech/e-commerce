'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { X } from 'lucide-react'
import { type KeyboardEvent, useState } from 'react'
import { toast } from 'sonner'
import { DataCard } from '@/components/layout/data-card'
import { customerDetailContent as copy } from '@/data/customers'
import { api } from '@/lib/api-client'

type TagsCardProps = {
  customerId: string
  tags: string[]
  onChanged: () => void
}

/** Free-form labels, saved on every add/remove (same pattern as order tags). */
export function CustomerTagsCard({ customerId, tags, onChanged }: TagsCardProps) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  async function save(next: string[]) {
    setSaving(true)
    try {
      await api.customers.update({ id: customerId, tags: next })
      toast.success(copy.tags.saved)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    e.preventDefault()
    const tag = draft.trim()
    if (!tag || tags.includes(tag)) return
    setDraft('')
    void save([...tags, tag])
  }

  return (
    <DataCard title={copy.tags.heading}>
      <div className="flex flex-col gap-3">
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <li
                key={t}
                className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-xs text-foreground"
              >
                {t}
                <button
                  type="button"
                  onClick={() => save(tags.filter((x) => x !== t))}
                  disabled={saving}
                  className="rounded-full p-0.5 hover:bg-primary/20"
                  aria-label={`Remove ${t}`}
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

type NoteCardProps = {
  customerId: string
  note: string | null
  onChanged: () => void
}

/** One internal note per customer; saved explicitly. */
export function CustomerNoteCard({ customerId, note, onChanged }: NoteCardProps) {
  const [draft, setDraft] = useState(note ?? '')
  const [saving, setSaving] = useState(false)
  const dirty = draft.trim() !== (note ?? '').trim()

  async function handleSave() {
    setSaving(true)
    try {
      await api.customers.update({ id: customerId, note: draft.trim() || null })
      toast.success(copy.note.saved)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

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
