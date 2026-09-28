'use client'

import { InfoIcon } from '@commerce/ui/icons'
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@commerce/ui/shadcn/popover'
import { paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'

/** The "What's this?" link: how online payments work, in two sentences. */
export default function WhatsThis() {
  // Hooks
  const copy = useCopy(paymentsSetupContent)

  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1 text-body font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <InfoIcon aria-hidden="true" className="size-4" />
        {copy.whatsThis.trigger}
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>{copy.whatsThis.title}</PopoverTitle>
          <PopoverDescription>{copy.whatsThis.body}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}
