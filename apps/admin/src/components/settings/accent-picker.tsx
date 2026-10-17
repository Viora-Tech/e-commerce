'use client'

import { ACCENT_PRESETS, accentForeground, normaliseAccent } from '@commerce/core/admin-accent'
import { CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { useId, useState } from 'react'
import { appearanceContent } from '@/data/appearance'

type AccentPickerProps = {
  /** `#rrggbb`. */
  value: string
  onChange: (hex: string) => void
  /** The line under the custom colour field (whose choice this is); a hex error replaces it. */
  help?: string
}

const copy = appearanceContent.accent

/** Named preset swatches plus a custom colour typed as a hex code. */
export default function AccentPicker({ value, onChange, help }: AccentPickerProps) {
  // Hooks
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)

  // Event handlers
  const handleText = (text: string) => {
    const hex = normaliseAccent(text)
    // Three digits is also a prefix of six: wait for the whole code while typing.
    if (hex && text.replace('#', '').trim().length === 6) {
      onChange(hex)
      setDraft(null)
      return
    }
    setDraft(text)
  }

  const handleBlur = () => {
    const hex = draft === null ? null : normaliseAccent(draft)
    if (hex) {
      onChange(hex)
      setDraft(null)
    }
  }

  // Render logic
  const invalid = draft !== null && normaliseAccent(draft) === null && draft.length >= 4

  return (
    <div className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-4 text-caption font-medium text-foreground">
          {copy.presetsLabel}
        </legend>
        <div className="flex flex-wrap gap-2.5">
          {ACCENT_PRESETS.map((p) => {
            const selected = p.hex === value
            const name = copy.presets[p.id] ?? p.id
            return (
              <label
                key={p.id}
                className="flex min-w-8 cursor-pointer flex-col items-center gap-1.5"
              >
                <input
                  type="radio"
                  name={`${id}-preset`}
                  value={p.hex}
                  checked={selected}
                  onChange={() => onChange(p.hex)}
                  className="peer sr-only"
                />
                <span
                  aria-hidden
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-shadow peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                    selected ? 'ring-2 ring-foreground' : 'hover:ring-2 hover:ring-line',
                  )}
                  style={{ backgroundColor: p.hex, color: accentForeground(p.hex) }}
                >
                  {selected ? <CheckIcon className="size-4" strokeWidth={2.5} /> : null}
                </span>
                <span
                  className={cn(
                    'text-caption whitespace-nowrap',
                    selected ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {name}
                </span>
              </label>
            )
          })}
        </div>
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-caption font-medium text-foreground">
          {copy.custom}
        </label>
        <Input
          id={id}
          value={draft ?? value}
          onChange={(e) => handleText(e.target.value)}
          onBlur={handleBlur}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-help`}
          spellCheck={false}
          autoComplete="off"
          maxLength={7}
          className="h-9"
        />
        {invalid ? (
          <p id={`${id}-help`} className="text-caption text-destructive">
            {copy.hexInvalid}
          </p>
        ) : help ? (
          <p id={`${id}-help`} className="text-caption text-muted-foreground">
            {help}
          </p>
        ) : null}
      </div>
    </div>
  )
}
