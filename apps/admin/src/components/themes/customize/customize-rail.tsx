'use client'

import { siteConfig } from '@commerce/config/site'
import { ListTree, Palette, Plus } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS, CHROME_TRANSITION } from '@/lib/customize-chrome'

export type RailPanel = 'sections' | 'add' | 'theme'

type CustomizeRailProps = {
  active: RailPanel
  onChange: (panel: RailPanel) => void
}

const ITEMS: { panel: RailPanel; icon: typeof ListTree }[] = [
  { panel: 'add', icon: Plus },
  { panel: 'sections', icon: ListTree },
  { panel: 'theme', icon: Palette },
]

/** The far-left icon rail (Figma "Website builder"): brand mark on top, the panels centred. */
export default function CustomizeRail({ active, onChange }: CustomizeRailProps) {
  // Hooks
  const copy = useCopy(customizeContent.rail)

  // Render logic
  return (
    <nav
      aria-label={copy.label}
      className="relative flex w-[3.25rem] shrink-0 flex-col items-center border-r border-border bg-card py-3"
    >
      <span
        aria-hidden
        className="key-primary flex size-8 items-center justify-center rounded-lg text-caption font-semibold"
      >
        {siteConfig.brand.name.charAt(0)}
      </span>
      <div className="absolute inset-y-0 flex flex-col items-center justify-center gap-1">
        {ITEMS.map(({ panel, icon: Icon }) => (
          <Tooltip key={panel}>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={() => onChange(panel)}
                  aria-label={copy[panel]}
                  aria-current={active === panel ? 'true' : undefined}
                  className={cn(
                    'flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    CHROME_TRANSITION,
                    CHROME_FOCUS,
                    active === panel &&
                      'bg-primary/10 text-primary ring-1 ring-primary/20 hover:bg-primary/10 hover:text-primary',
                  )}
                />
              }
            >
              <Icon aria-hidden weight="regular" className="size-[1.125rem]" />
            </TooltipTrigger>
            <TooltipContent side="right">{copy[panel]}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </nav>
  )
}
