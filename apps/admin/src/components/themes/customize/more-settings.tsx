'use client'

import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import type { ReactNode } from 'react'
import { CHROME_FOCUS } from '@/lib/customize-chrome'

type MoreSettingsProps = {
  label: string
  children: ReactNode
}

/**
 * The exact controls behind a Theme panel group's simple choices ("All colours", "More type
 * settings"): a quiet link that folds them open below, so the panel reads as Figma's short list
 * and nothing the theme can do is lost.
 */
export default function MoreSettings({ label, children }: MoreSettingsProps) {
  // Render logic
  return (
    <Collapsible className="flex flex-col">
      <CollapsibleTrigger
        className={`group flex w-fit items-center gap-1 rounded-sm text-[0.8125rem] leading-[1.1875rem] font-medium text-link hover:underline ${CHROME_FOCUS}`}
      >
        {label}
        <ChevronDown
          aria-hidden
          className="size-3.5 transition-transform duration-150 group-data-[panel-open]:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-4 pt-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
