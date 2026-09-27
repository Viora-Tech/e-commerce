'use client'

import { ListTree, Palette, Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { customizeContent } from '@/data/customize'
import { CHROME_FOCUS, CHROME_TRANSITION } from '@/lib/customize-chrome'

export type RailPanel = 'sections' | 'add' | 'theme'

type CustomizeRailProps = {
  active: RailPanel
  onChange: (panel: RailPanel) => void
}

const copy = customizeContent.rail

const ITEMS: { panel: RailPanel; icon: typeof ListTree; label: string }[] = [
  { panel: 'sections', icon: ListTree, label: copy.sections },
  { panel: 'add', icon: Plus, label: copy.add },
  { panel: 'theme', icon: Palette, label: copy.theme },
]

/** Puck Cloud's slim icon rail: which of the left panels is showing. */
export default function CustomizeRail({ active, onChange }: CustomizeRailProps) {
  // Render logic
  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-0.5 py-1">
      {ITEMS.map(({ panel, icon: Icon, label }) => (
        <button
          key={panel}
          type="button"
          onClick={() => onChange(panel)}
          aria-label={label}
          aria-current={active === panel ? 'true' : undefined}
          title={label}
          className={cn(
            'flex w-12 flex-col items-center gap-1 rounded-lg pt-2 pb-1.5 text-[0.6875rem] leading-3 font-medium',
            CHROME_TRANSITION,
            CHROME_FOCUS,
            active === panel
              ? 'text-foreground'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
        >
          <span
            className={cn(
              'flex size-8 items-center justify-center rounded-lg',
              CHROME_TRANSITION,
              active === panel && 'bg-primary/10 text-primary ring-1 ring-primary/20',
            )}
          >
            {/* One weight everywhere in the chrome: regular, 16px. */}
            <Icon aria-hidden weight="regular" className="size-4" />
          </span>
          {label}
        </button>
      ))}
    </nav>
  )
}
