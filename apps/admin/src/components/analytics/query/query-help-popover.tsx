'use client'

import { HelpCircle } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'

/** The "?" beside the editor: the language on one card, and the keyboard shortcuts. */
export default function QueryHelpPopover() {
  // Hooks
  const copy = useCopy(analyticsContent.query.help)

  // Render logic
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={copy.label}
          >
            <HelpCircle className="size-4" />
          </Button>
        }
      />
      <PopoverContent
        align="end"
        sideOffset={8}
        className="flex max-h-[min(32rem,75svh)] w-[min(24rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto p-3"
      >
        <p className="text-body font-medium text-popover-foreground">{copy.title}</p>
        <dl className="flex flex-col gap-2">
          {copy.clauses.map((c) => (
            <div key={c.code} className="flex flex-col gap-0.5">
              <dt className="font-mono text-caption text-info">{c.code}</dt>
              <dd className="text-caption text-muted-foreground">{c.text}</dd>
            </div>
          ))}
        </dl>
        <p className="text-body font-medium text-popover-foreground">{copy.shortcutsTitle}</p>
        <ul className="flex flex-col gap-1.5">
          {copy.shortcuts.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-3 text-caption">
              <span className="text-muted-foreground">{s.text}</span>
              <Kbd>{s.keys}</Kbd>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
