'use client'

import { InfoIcon } from '@commerce/ui/icons'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@commerce/ui/shadcn/popover'
import { senderEmailContent } from '@/data/sender-email'

const copy = senderEmailContent.spam

/** "Why emails might land in spam": the five usual reasons, in plain words. */
export default function SpamHelp() {
  return (
    <Popover>
      <PopoverTrigger className="inline-flex items-center gap-1 text-body font-medium text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <InfoIcon aria-hidden="true" className="size-4" />
        {copy.trigger}
      </PopoverTrigger>
      <PopoverContent className="w-96 max-w-[calc(100vw-2rem)]">
        <PopoverHeader>
          <PopoverTitle>{copy.title}</PopoverTitle>
        </PopoverHeader>
        <ul className="mt-2 flex list-disc flex-col gap-1.5 pl-5 text-body text-foreground">
          {copy.points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mt-3 text-caption text-muted-foreground">{copy.footer}</p>
      </PopoverContent>
    </Popover>
  )
}
