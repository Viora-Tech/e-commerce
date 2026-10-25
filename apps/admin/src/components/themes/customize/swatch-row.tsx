'use client'

import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import { toHex } from '@/lib/theme-quick-settings'

type SwatchRowProps = {
  label: string
  /** `#RRGGBB`. */
  value: string
  onChange: (hex: string) => void
}

/**
 * One colour of the Theme panel (Figma 369:121898 "Swatch row"): a 28px swatch that opens the
 * system colour picker, the colour's name, and its code on the right, which can be typed or
 * pasted over (kept only once it is a whole colour).
 */
export default function SwatchRow({ label, value, onChange }: SwatchRowProps) {
  // Hooks
  const copy = useCopy(customizeContent.themePanel)
  const [draft, setDraft] = useState<string | null>(null)

  // Event handlers
  const handleText = (text: string) => {
    const hex = toHex(text)
    if (hex) {
      onChange(hex)
      setDraft(null)
      return
    }
    setDraft(text)
  }

  // Render logic
  return (
    <div className="flex items-center gap-2.5">
      <label
        className="relative size-7 shrink-0 cursor-pointer overflow-hidden rounded-[0.5rem] border border-border focus-within:ring-2 focus-within:ring-ring"
        style={{ backgroundColor: value }}
      >
        <input
          type="color"
          value={value.toLowerCase()}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={copy.pickOf(label)}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </label>
      <span className="min-w-0 flex-1 truncate text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground">
        {label}
      </span>
      <input
        value={draft ?? value}
        onChange={(e) => handleText(e.target.value)}
        onBlur={() => setDraft(null)}
        aria-label={copy.hexOf(label)}
        aria-invalid={draft !== null || undefined}
        spellCheck={false}
        maxLength={7}
        className={`w-[4.75rem] rounded-md bg-transparent px-1.5 py-0.5 text-right text-xs leading-[1.0625rem] text-muted-foreground uppercase tabular-nums hover:bg-muted focus:bg-muted focus:text-foreground aria-invalid:text-danger ${CHROME_FOCUS}`}
      />
    </div>
  )
}
