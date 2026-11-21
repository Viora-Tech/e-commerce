'use client'

import { ChevronDown } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import type { ReactNode } from 'react'
import StatusChip from '@/components/layout/status-chip'
import { deliveryOptionQuestionsContent } from '@/data/delivery-option-questions'
import { useCopy } from '@/hooks/use-copy'

type MoreSettingsProps = {
  /** What is inside, in a few words ("Markup, limits, insurance, COD fee"). */
  hint: string
  /** How many settings inside differ from their default. */
  changed: number
  children: ReactNode
}

/**
 * The one collapsed "More settings" under the 3 delivery questions (owner, 21 Nov 2026). Closed
 * by default; it starts open when a setting inside differs from its default, and the closed
 * header says how many ("3 changed"), as the product rule dialog's "More".
 */
export default function MoreSettings({ hint, changed, children }: MoreSettingsProps) {
  // Hooks
  const copy = useCopy(deliveryOptionQuestionsContent)

  // Render logic
  const t = copy.more

  return (
    <Collapsible defaultOpen={changed > 0} className="rounded-lg border border-panel-border">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-lg px-3.5 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown
          aria-hidden
          className="size-4 shrink-0 -rotate-90 text-muted-foreground transition-[rotate] duration-150 ease-out group-data-[panel-open]:rotate-0"
        />
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-body font-medium text-ink-strong">{t.title}</span>
          <span className="text-caption text-muted-foreground">{hint}</span>
        </span>
        {changed > 0 ? (
          <span className="group-data-[panel-open]:hidden">
            <StatusChip tone="info">{t.changed(changed)}</StatusChip>
          </span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t border-hairline px-3.5 py-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
