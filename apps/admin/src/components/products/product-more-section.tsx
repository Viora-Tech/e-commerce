'use client'

import { ChevronDown } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import type { ReactNode } from 'react'
import { productFormContent } from '@/data/product-form'
import { useCopy } from '@/hooks/use-copy'

type ProductMoreSectionProps = {
  children: ReactNode
  /** Controlled by the form, so the jump nav and a validation error inside can open it. */
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Rarely-used cards (pre-order, custom data, template, stock history), collapsed by default. */
export default function ProductMoreSection({
  children,
  open,
  onOpenChange,
}: ProductMoreSectionProps) {
  // Hooks
  const { more: copy } = useCopy(productFormContent)

  // Render logic
  return (
    <section id="more" className="scroll-mt-[calc(var(--detail-header-height,11rem)+1rem)]">
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <CollapsibleTrigger className="flex w-full items-center justify-between border-border border-b px-6 py-4 text-left hover:bg-muted/40">
          <span className="flex flex-col">
            <span className="text-body font-medium text-ink-strong">{copy.heading}</span>
            <span className="text-caption text-muted-foreground">{copy.help}</span>
          </span>
          <ChevronDown
            className={cn(
              'size-4 text-muted-foreground transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col">{children}</CollapsibleContent>
      </Collapsible>
    </section>
  )
}
