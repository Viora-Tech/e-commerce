'use client'

import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import type { ReactNode } from 'react'

type SettingGroupProps = {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

/** One collapsible section of the theme settings panel, like Shopify's theme settings. */
export default function SettingGroup({ title, defaultOpen = false, children }: SettingGroupProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className="border-b border-border last:border-b-0">
      <CollapsibleTrigger className="group flex h-11 w-full items-center justify-between gap-3 px-4 text-left text-[0.8125rem] font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
        {title}
        <ChevronDown
          className="size-4 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-4 px-4 pt-1 pb-5">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  )
}
