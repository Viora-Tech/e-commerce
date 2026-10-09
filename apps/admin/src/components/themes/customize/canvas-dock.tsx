'use client'

import { Moon, Sun } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'

type CanvasDockProps = {
  mode: 'light' | 'dark'
  /** Show the light/dark switch only when the theme has a dark mode. */
  darkMode: boolean
  onMode: (mode: 'light' | 'dark') => void
}

const MODES = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
] as const

const DOCK_BUTTON =
  'flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none motion-reduce:transition-none [&_svg]:size-4'
const DOCK_ACTIVE = 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'

/** Floating pill under the canvas: light or dark preview, when the theme has a dark mode. */
export default function CanvasDock({ mode, darkMode, onMode }: CanvasDockProps) {
  // Hooks
  const modes = useCopy(themesContent.preview.modes)

  // Early returns
  if (!darkMode) return null

  // Render logic
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full border border-border bg-popover/95 p-1 shadow-dialog backdrop-blur-sm">
        {MODES.map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onMode(value)}
            aria-label={modes[value]}
            aria-pressed={mode === value}
            title={modes[value]}
            className={cn(DOCK_BUTTON, mode === value && DOCK_ACTIVE)}
          >
            <Icon aria-hidden weight="regular" />
          </button>
        ))}
      </div>
    </div>
  )
}
