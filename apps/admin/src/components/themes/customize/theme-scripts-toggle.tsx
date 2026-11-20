'use client'

import { Pencil, Play } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { themeEditorAppsContent } from '@/data/theme-editor-apps'
import { useCopy } from '@/hooks/use-copy'

type ThemeScriptsToggleProps = {
  on: boolean
  onChange: (on: boolean) => void
}

const PILL =
  'pointer-events-auto flex h-8 items-center gap-1.5 rounded-full border border-border bg-popover px-3 text-caption font-medium text-foreground shadow-popover transition-colors duration-150 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none'

/**
 * The canvas switch between the editing canvas and the "Theme scripts" view (the page on the
 * store's own address with an imported theme's JavaScript running), floating at the bottom right
 * of the canvas, with a line saying what the scripts view does while it is on.
 */
export default function ThemeScriptsToggle({ on, onChange }: ThemeScriptsToggleProps) {
  // Hooks
  const copy = useCopy(themeEditorAppsContent)

  // Render logic
  const Icon = on ? Pencil : Play

  return (
    <div className="pointer-events-none absolute right-6 bottom-6 z-10 flex max-w-[22rem] flex-col items-end gap-2">
      {on ? (
        <p
          role="status"
          className="rounded-lg bg-popover px-3 py-2 text-xs text-muted-foreground shadow-popover"
        >
          {copy.scriptsNote}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => onChange(!on)}
        aria-pressed={on}
        title={on ? copy.scriptsOff : copy.scriptsOn}
        className={cn(PILL, on && 'border-primary text-primary')}
      >
        <Icon aria-hidden weight="regular" className="size-4" />
        {copy.scripts}
      </button>
    </div>
  )
}
