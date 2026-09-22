'use client'

import { ChevronDown } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import { type ReactNode, useState } from 'react'

type EditorGroupProps = {
  title: string
  body: string
  defaultOpen?: boolean
  children: ReactNode
}

/** One collapsible section of the invoice editor, like invoicely's accordion groups. */
export default function EditorGroup({ title, body, defaultOpen, children }: EditorGroupProps) {
  // Hooks
  const [open, setOpen] = useState(defaultOpen ?? false)

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-[0.75rem] border border-border bg-card"
    >
      <CollapsibleTrigger className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-body font-medium text-foreground">{title}</span>
          <span className="text-caption text-muted-foreground">{body}</span>
        </span>
        <ChevronDown
          className={cn(
            'mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform',
            open && 'rotate-180',
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 border-t border-border px-4 py-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
