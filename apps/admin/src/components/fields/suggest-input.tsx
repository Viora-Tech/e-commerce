'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { useId } from 'react'

type SuggestInputProps = {
  id?: string | undefined
  value: string
  onChange: (value: string) => void
  /** Existing values in the store, offered as the merchant types. */
  suggestions: readonly string[]
  placeholder?: string | undefined
  size?: 'lg' | 'kit'
}

const MAX_SUGGESTIONS = 50

/**
 * Free text with suggestions from a native datalist. Vendors and product
 * types are open vocabularies, so a combobox that forces a pick would be wrong.
 */
export default function SuggestInput({
  id,
  value,
  onChange,
  suggestions,
  placeholder,
  size = 'lg',
}: SuggestInputProps) {
  // Hooks
  const listId = useId()

  return (
    <>
      <Input
        size={size}
        id={id}
        list={listId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <datalist id={listId}>
        {suggestions.slice(0, MAX_SUGGESTIONS).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  )
}
