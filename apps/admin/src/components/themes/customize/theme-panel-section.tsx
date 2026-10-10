'use client'

import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import type { ReactNode } from 'react'
import { CHROME_FOCUS } from '@/lib/customize-chrome'

type ThemePanelSectionProps = {
  title: string
  /** Colours, Typography and Buttons start open; the rows under them start closed. */
  defaultOpen?: boolean
  children: ReactNode
}

/**
 * One group of the editor's Theme panel (Figma 369:121891 "Left panel / Stack"): a 14px
 * semibold name with a chevron (down when open, right when closed) over a hairline, its
 * settings 10px apart under it.
 */
export default function ThemePanelSection({
  title,
  defaultOpen = false,
  children,
}: ThemePanelSectionProps) {
  // Render logic
  return (
    <Collapsible defaultOpen={defaultOpen} className="flex flex-col border-b border-border pb-3">
      <CollapsibleTrigger
        className={`group flex min-h-5 items-center gap-2 rounded-sm text-left text-sm leading-5 font-semibold text-foreground ${CHROME_FOCUS}`}
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <ChevronDown
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-not-data-[panel-open]:-rotate-90 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-2.5 pt-2.5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
