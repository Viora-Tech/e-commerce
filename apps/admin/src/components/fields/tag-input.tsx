'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { Input } from '@commerce/ui/shadcn/input'
import { X } from 'lucide-react'
import { type KeyboardEvent, useId, useState } from 'react'
import { productFormContent } from '@/data/products'

type TagInputProps = {
  id?: string | undefined
  tags: string[]
  suggestions: readonly string[]
  onChange: (tags: string[]) => void
  placeholder?: string | undefined
}

const MAX_SUGGESTIONS = 50

const sameTag = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** Enter or comma adds the typed tag; Backspace on an empty box removes the last one. */
export function TagInput({ id, tags, suggestions, onChange, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState('')
  const listId = useId()

  const open = suggestions.filter((s) => !tags.some((t) => sameTag(t, s))).slice(0, MAX_SUGGESTIONS)

  const add = (raw: string) => {
    const tag = raw.trim()
    if (!tag || tags.some((t) => sameTag(t, tag))) return
    onChange([...tags, tag])
  }
  const remove = (tag: string) => onChange(tags.filter((t) => t !== tag))

  const commit = () => {
    add(draft)
    setDraft('')
  }

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Backspace' && draft === '' && tags.length) {
      onChange(tags.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        id={id}
        list={listId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKey}
        onBlur={commit}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {open.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
      {tags.length ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              {tag}
              <button
                type="button"
                className="rounded-sm opacity-60 hover:opacity-100"
                onClick={() => remove(tag)}
                aria-label={productFormContent.organisation.removeTag(tag)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
    </div>
  )
}
