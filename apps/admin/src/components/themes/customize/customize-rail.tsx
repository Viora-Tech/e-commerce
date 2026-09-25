'use client'

import { ListTree, Palette, Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { customizeContent } from '@/data/customize'

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
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 py-1">
      {ITEMS.map(({ panel, icon: Icon, label }) => (
        <button
          key={panel}
          type="button"
          onClick={() => onChange(panel)}
          aria-label={label}
          aria-current={active === panel ? 'true' : undefined}
          title={label}
          className={cn(
            'flex w-12 flex-col items-center gap-1 rounded-xl py-2 text-[0.6875rem] transition-colors',
            active === panel
              ? 'bg-primary-soft text-primary shadow-card ring-1 ring-primary/20'
              : 'text-muted-foreground hover:bg-card/60 hover:text-foreground',
          )}
        >
          <Icon aria-hidden weight={active === panel ? 'regular' : 'light'} className="size-5" />
          {label}
        </button>
      ))}
    </nav>
  )
}
