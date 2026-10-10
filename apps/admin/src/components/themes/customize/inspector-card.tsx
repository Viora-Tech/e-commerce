'use client'

import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import type { ReactNode } from 'react'
import { CHROME_FOCUS } from '@/lib/customize-chrome'

type InspectorCardProps = {
  title: string
  /** Something in the group differs from the theme's default: a dot after the title. */
  changed?: boolean
  children: ReactNode
}

/**
 * One group of settings in the right panel (Figma "Inspector / Stack", 381:6222): a bordered
 * card, 12px radius, its name in 13px semibold with a chevron, open by default; the fields sit
 * 10px apart on the card's 12px gutter.
 */
export default function InspectorCard({ title, changed, children }: InspectorCardProps) {
  // Render logic
  return (
    <Collapsible defaultOpen className="rounded-xl border border-border bg-card">
      <CollapsibleTrigger
        className={`group flex w-full items-center gap-2 rounded-xl py-2.5 pr-2.5 pl-3 text-left ${CHROME_FOCUS}`}
      >
        <span className="text-[0.8125rem] leading-[1.1875rem] font-semibold text-foreground">
          {title}
        </span>
        {changed ? <span aria-hidden className="size-1.5 rounded-full bg-primary" /> : null}
        <span className="flex-1" />
        <ChevronDown
          aria-hidden
          className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 group-not-data-[panel-open]:-rotate-90 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-2.5 px-3 pb-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
