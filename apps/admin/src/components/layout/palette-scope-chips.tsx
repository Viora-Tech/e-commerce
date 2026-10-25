'use client'

import { cn } from '@commerce/ui/lib/utils'
import { motion } from 'motion/react'
import { paletteContent } from '@/data/command-palette'
import { useCopy } from '@/hooks/use-copy'
import { pill } from '@/lib/motion'
import { PALETTE_SCOPES, type PaletteScope } from '@/lib/palette-search'

type PaletteScopeChipsProps = {
  scope: PaletteScope
  onChange: (scope: PaletteScope) => void
}

/**
 * All · Orders · Products · Customers · Pages · Settings. Tab and Shift+Tab cycle them from
 * the input, so the chips themselves stay out of the tab order; clicking one never steals focus.
 */
export default function PaletteScopeChips({ scope, onChange }: PaletteScopeChipsProps) {
  // Hooks
  const copy = useCopy(paletteContent)

  return (
    <div
      role="tablist"
      aria-label={copy.scopesLabel}
      className="flex items-center gap-1 overflow-x-auto px-4 pb-3 [scrollbar-width:none]"
    >
      {PALETTE_SCOPES.map((value) => {
        const active = value === scope
        return (
          <button
            key={value}
            type="button"
            role="tab"
            id={`palette-scope-${value}`}
            aria-selected={active}
            tabIndex={-1}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(value)}
            className={cn(
              'relative h-[1.875rem] shrink-0 rounded-full px-3 text-[0.8125rem] font-medium transition-colors',
              active ? 'text-glass-active-ink' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active ? (
              <motion.span
                layoutId="palette-scope-pill"
                transition={pill}
                className="absolute inset-0 rounded-full bg-glass-active"
              />
            ) : null}
            <span className="relative">{copy.scopes[value]}</span>
          </button>
        )
      })}
    </div>
  )
}
