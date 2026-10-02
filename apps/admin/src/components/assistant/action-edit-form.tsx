'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import KitButton from '@/components/kit/kit-button'
import { assistantContent } from '@/data/assistant'
import type { ActionView } from '@/hooks/use-assistant'
import { useCopy } from '@/hooks/use-copy'

type ActionEditFormProps = {
  fields: ActionView['editable']
  busy: boolean
  onSave: (changes: Record<string, string | number | null>) => void
  onBack: () => void
}

type Draft = Record<string, string>

function draftOf(fields: ActionView['editable']): Draft {
  return Object.fromEntries(fields.map((f) => [f.key, f.value === null ? '' : String(f.value)]))
}

/** Edit on a change card: the few values the merchant may adjust, re-checked on the server. */
export default function ActionEditForm({ fields, busy, onSave, onBack }: ActionEditFormProps) {
  // Hooks
  const copy = useCopy(assistantContent)
  const [draft, setDraft] = useState<Draft>(() => draftOf(fields))

  // Event handlers
  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const changes = Object.fromEntries(
      fields.map((f) => {
        const value = draft[f.key]?.trim() ?? ''
        if (!value) return [f.key, null]
        return [f.key, f.kind === 'number' ? Number(value) : value]
      }),
    )
    onSave(changes)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {fields.map((field) => (
        <div key={field.key} className="flex flex-col gap-1.5">
          <label
            htmlFor={`ai-edit-${field.key}`}
            className="text-caption font-medium text-foreground"
          >
            {copy.card.fields[field.key] ?? field.key}
          </label>
          {field.kind === 'textarea' ? (
            <Textarea
              id={`ai-edit-${field.key}`}
              size="kit"
              value={draft[field.key] ?? ''}
              onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
              className="max-h-60"
            />
          ) : (
            <Input
              id={`ai-edit-${field.key}`}
              size="kit"
              type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
              value={draft[field.key] ?? ''}
              onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
            />
          )}
        </div>
      ))}
      <div className="flex items-center gap-2">
        <KitButton type="submit" variant="primary" disabled={busy}>
          {copy.card.save}
        </KitButton>
        <KitButton variant="secondary" onClick={onBack} disabled={busy}>
          {copy.card.back}
        </KitButton>
      </div>
    </form>
  )
}
