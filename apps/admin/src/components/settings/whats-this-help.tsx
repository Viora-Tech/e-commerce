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

type WhatsThisHelpProps = {
  /** The link text, usually "What's this?". */
  trigger: string
  title: string
  body: string
}

/** A "What's this?" link that opens a short plain-words explanation. */
export default function WhatsThisHelp({ trigger, title, body }: WhatsThisHelpProps) {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1 text-body font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <InfoIcon aria-hidden="true" className="size-4" />
        {trigger}
      </PopoverTrigger>
      <PopoverContent className="w-80 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{body}</PopoverDescription>
        </PopoverHeader>
      </PopoverContent>
    </Popover>
  )
}
