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
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-border bg-card py-2">
      {ITEMS.map(({ panel, icon: Icon, label }) => (
        <button
          key={panel}
          type="button"
          onClick={() => onChange(panel)}
          aria-label={label}
          aria-current={active === panel ? 'true' : undefined}
          title={label}
          className={cn(
            'flex w-11 flex-col items-center gap-1 rounded-md py-2 text-[0.6875rem] transition-colors',
            active === panel
              ? 'bg-primary-soft text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
        >
          <Icon aria-hidden className="size-4.5" />
          {label}
        </button>
      ))}
    </nav>
  )
}
