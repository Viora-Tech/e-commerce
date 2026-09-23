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
}

const copy = appearanceContent.accent

/** Preset swatches plus a custom colour: the system picker or a typed hex code. */
export default function AccentPicker({ value, onChange }: AccentPickerProps) {
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
    if (hex) onChange(hex)
    setDraft(null)
  }

  // Render logic
  const invalid = draft !== null && normaliseAccent(draft) === null && draft.length >= 4

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-wrap gap-3">
        <legend className="sr-only">{copy.presetsLabel}</legend>
        {ACCENT_PRESETS.map((p) => {
          const selected = p.hex === value
          const name = copy.presets[p.id] ?? p.id
          return (
            <label key={p.id} title={name} className="cursor-pointer">
              <input
                type="radio"
                name={`${id}-preset`}
                value={p.hex}
                checked={selected}
                onChange={() => onChange(p.hex)}
                className="peer sr-only"
              />
              <span className="sr-only">{name}</span>
              <span
                aria-hidden
                className={cn(
                  'flex size-9 items-center justify-center rounded-full ring-offset-2 ring-offset-card transition-shadow peer-focus-visible:ring-2 peer-focus-visible:ring-ring',
                  selected ? 'ring-2 ring-foreground' : 'hover:ring-2 hover:ring-line',
                )}
                style={{ backgroundColor: p.hex, color: accentForeground(p.hex) }}
              >
                {selected ? <CheckIcon className="size-4" strokeWidth={2.5} /> : null}
              </span>
            </label>
          )
        })}
      </fieldset>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={id} className="text-body font-medium text-foreground">
          {copy.custom}
        </label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            aria-label={copy.customPicker}
            className="size-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
          />
          <Input
            id={id}
            value={draft ?? value}
            onChange={(e) => handleText(e.target.value)}
            onBlur={handleBlur}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? `${id}-error` : undefined}
            spellCheck={false}
            autoComplete="off"
            maxLength={7}
            className="h-9 w-28 font-mono text-xs"
          />
        </div>
        {invalid ? (
          <p id={`${id}-error`} className="text-caption text-destructive">
            {copy.hexInvalid}
          </p>
        ) : null}
      </div>
    </div>
  )
}
