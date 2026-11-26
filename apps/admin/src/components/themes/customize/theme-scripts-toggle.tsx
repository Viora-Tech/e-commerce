'use client'

import { Pencil, Play } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { themeEditorAppsContent } from '@/data/theme-editor-apps'
import { useCopy } from '@/hooks/use-copy'
import { useThemeScriptsView } from '@/lib/theme-scripts-view'

const PILL =
  'flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-caption font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none motion-reduce:transition-none [&_svg]:size-4'

/**
 * The top bar's "Interactive preview" switch, beside the device and zoom controls: it swaps the
 * editing canvas for the page on the store's own address with an imported theme's own
 * JavaScript running (sliders, tabs, menus). It sat over the canvas before and covered the
 * store's own buttons (the Loyalty launcher); in the bar it never covers the page. Drawn only
 * when the theme has that view (`ThemeScriptsViewContext`).
 */
export default function ThemeScriptsToggle() {
  // Hooks
  const copy = useCopy(themeEditorAppsContent)
  const view = useThemeScriptsView()

  // Early returns
  if (!view) return null

  // Render logic
  const { on, setOn } = view
  const Icon = on ? Pencil : Play

  return (
    <button
      type="button"
      onClick={() => setOn(!on)}
      aria-pressed={on}
      title={on ? `${copy.scriptsOff} ${copy.scriptsNote}` : copy.scriptsOn}
      className={cn(
        PILL,
        on && 'bg-primary-soft text-primary hover:bg-primary-soft hover:text-primary',
      )}
    >
      <Icon aria-hidden weight="regular" />
      <span className="hidden xl:inline">{on ? copy.scriptsStop : copy.scripts}</span>
    </button>
  )
}
