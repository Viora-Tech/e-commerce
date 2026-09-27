'use client'

import { ChevronDown } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@commerce/ui/shadcn/collapsible'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { productFormContent } from '@/data/products'

type ProductMoreSectionProps = { children: ReactNode }

const copy = productFormContent.more

/** Rarely-used cards (pre-order, custom data, template, stock history), collapsed by default. */
export default function ProductMoreSection({ children }: ProductMoreSectionProps) {
  // Hooks
  const [open, setOpen] = useState(false)

  // Render logic
  return (
    <div id="more" className="border-t border-border">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-4 text-left hover:bg-muted/40 md:px-6">
          <div className="flex flex-col">
            <span className="text-body font-medium text-ink-strong">{copy.heading}</span>
            <span className="text-caption text-muted-foreground">{copy.help}</span>
          </div>
          <ChevronDown
            className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col">{children}</CollapsibleContent>
      </Collapsible>
    </div>
  )
}
