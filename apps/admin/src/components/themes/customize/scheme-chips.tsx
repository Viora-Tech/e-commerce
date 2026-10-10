'use client'

import { cn } from '@commerce/ui/lib/utils'
import { useId } from 'react'
import { SWATCH_CHIP, swatchChipState } from '@/lib/customize-field-styles'
import { useThemePreview } from '@/lib/customize-theme-context'

type SchemeChipsProps = {
  label: string
  options: { label: string; value: string }[]
  value: string
  onChange: (value: string) => void
}

/**
 * Colour schemes as swatch chips (Figma inspector 369:5147): each chip shows the scheme's own
 * background with its button colour as a dot, named as the theme names it, so the merchant
 * picks by look instead of by "Scheme 3". The chosen chip wears the accent ring.
 */
export default function SchemeChips({ label, options, value, onChange }: SchemeChipsProps) {
  // Hooks
  const id = useId()
  const theme = useThemePreview()

  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={id} className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const scheme = theme?.schemes.find((s) => s.id === o.value)
          const checked = o.value === value
          return (
            // biome-ignore lint/a11y/useSemanticElements: a styled chip or segment in a radio group; a native radio input cannot carry this look.
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(o.value)}
              className={cn(SWATCH_CHIP, swatchChipState(checked))}
            >
              <span
                aria-hidden
                className="relative flex size-4 shrink-0 items-center justify-center rounded-full ring-1 ring-border ring-inset"
                style={scheme ? { backgroundColor: scheme.background } : undefined}
              >
                {scheme ? (
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: scheme.button }}
                  />
                ) : null}
              </span>
              {scheme?.name ?? o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
