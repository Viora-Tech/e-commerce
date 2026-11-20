'use client'

import { InfoIcon } from '@commerce/ui/icons'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'

type ColumnHelpHeadProps = {
  label: string
  /** One line saying what the column's switch does. */
  help: string
  /** Read out for the info button: "About Use at checkout". */
  aboutLabel: string
}

/**
 * A table heading with an info button whose tooltip says what the column means: the Routes
 * table's two switch columns, which looked alike and said nothing (#1781).
 */
export default function ColumnHelpHead({ label, help, aboutLabel }: ColumnHelpHeadProps) {
  // Render logic
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={aboutLabel}
              className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-ink-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          }
        >
          <InfoIcon aria-hidden className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-64 normal-case">
          {help}
        </TooltipContent>
      </Tooltip>
    </span>
  )
}
