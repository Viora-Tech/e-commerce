'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { useId, useState } from 'react'
import { themesContent as copy } from '@/data/themes'

type ColourFieldProps = {
  label: string
  value: string
  onChange: (hex: string) => void
}

const HEX = /^#[0-9a-fA-F]{6}$/

/** "1f1f21" and "#1f1f21" both become "#1F1F21"; anything else is not a colour yet. */
function normaliseHex(text: string): string | null {
  const t = text.trim()
  const withHash = t.startsWith('#') ? t : `#${t}`
  return HEX.test(withHash) ? withHash.toUpperCase() : null
}

/** Swatch plus hex box. The swatch opens the system picker; the box takes typed or pasted hex. */
export default function ColourField({ label, value, onChange }: ColourFieldProps) {
  // Hooks
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)

  // Event handlers
  const handleText = (text: string) => {
    const hex = normaliseHex(text)
    if (hex) {
      onChange(hex)
      setDraft(null)
      return
    }
    setDraft(text)
  }

  // Render logic
  const invalid = draft !== null

  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={id} className="text-body text-foreground">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={label}
          className="size-8 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        />
        <Input
          id={id}
          value={draft ?? value}
          onChange={(e) => handleText(e.target.value)}
          onBlur={() => setDraft(null)}
          aria-invalid={invalid || undefined}
          title={invalid ? copy.colours.hexInvalid : undefined}
          spellCheck={false}
          maxLength={7}
          className="h-8 w-24 font-mono text-xs uppercase"
        />
      </div>
    </div>
  )
}
