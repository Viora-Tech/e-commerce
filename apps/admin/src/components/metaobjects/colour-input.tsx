'use client'

import { normaliseHex } from '@commerce/core/metaobjects'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { fieldInputContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'

type ColourInputProps = {
  id: string
  value: unknown
  invalid?: boolean | undefined
  onChange: (value: string) => void
}

/** What the system picker shows before a colour is chosen. */
const PICKER_START = '#000000'

/**
 * A colour field: the swatch opens the phone's or computer's colour picker, the box takes a
 * typed or pasted hex code. Saves `#rrggbb`; an unfinished code stays in the box only.
 */
export default function ColourInput({ id, value, invalid, onChange }: ColourInputProps) {
  // Hooks
  const copy = useCopy(fieldInputContent)
  const [draft, setDraft] = useState<string | null>(null)

  // Event handlers
  const handleText = (text: string) => {
    const withHash = text.trim().startsWith('#') ? text.trim() : `#${text.trim()}`
    const hex = normaliseHex(withHash)
    if (hex || text.trim() === '') {
      onChange(hex ?? '')
      setDraft(null)
      return
    }
    setDraft(text)
  }

  // Render logic
  const hex = normaliseHex(value)
  const shown = draft ?? (hex ? hex.toUpperCase() : '')
  const draftBad = draft !== null

  return (
    <div className="flex items-center gap-2">
      {/* The native picker sits invisible on top of our own swatch, so "no colour yet" reads as
          an empty dashed square instead of the picker's black. */}
      <span
        className={cn(
          'relative size-9 shrink-0 overflow-hidden rounded-md border p-0.5',
          hex ? 'border-border' : 'border-dashed border-border-strong',
        )}
      >
        {hex ? (
          <span className="block size-full rounded-[0.25rem]" style={{ backgroundColor: hex }} />
        ) : null}
        <input
          type="color"
          value={hex ?? PICKER_START}
          aria-label={copy.colour.swatch}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </span>
      <Input
        id={id}
        size="lg"
        value={shown}
        placeholder="#1A2B3C"
        spellCheck={false}
        maxLength={7}
        aria-invalid={invalid || draftBad || undefined}
        title={draftBad ? copy.colour.invalid : undefined}
        onChange={(e) => handleText(e.target.value)}
        onBlur={() => setDraft(null)}
        className="w-36 font-mono uppercase"
      />
      {draftBad ? (
        <span className="text-caption text-destructive">{copy.colour.invalid}</span>
      ) : null}
    </div>
  )
}
