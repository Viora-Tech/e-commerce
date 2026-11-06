'use client'

import { Moon, Sun } from '@commerce/ui/icons'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'

type CanvasDockProps = {
  mode: 'light' | 'dark'
  /** Show the light/dark switch only when the theme has a dark mode. */
  darkMode: boolean
  onMode: (mode: 'light' | 'dark') => void
}

const MODE_BUTTON =
  'flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/** One button in the top bar: shows the mode a click switches the preview to. */
export default function CanvasDock({ mode, darkMode, onMode }: CanvasDockProps) {
  // Hooks
  const modes = useCopy(themesContent.preview.modes)

  // Early returns
  if (!darkMode) return null

  // Render logic
  const next = mode === 'light' ? 'dark' : 'light'
  const Icon = next === 'dark' ? Moon : Sun

  return (
    <button
      type="button"
      onClick={() => onMode(next)}
      aria-label={modes[next]}
      title={modes[next]}
      className={MODE_BUTTON}
    >
      <Icon aria-hidden weight="regular" />
    </button>
  )
}
