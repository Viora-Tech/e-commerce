'use client'

import { CheckIcon, ChevronsUpDown } from '@commerce/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'

export type ViewOption<V extends string | null> = { value: V; label: string; count?: number }

type ViewSelectProps<V extends string | null> = {
  value: V
  options: ViewOption<V>[]
  onChange: (value: V) => void
  /** Accessible name for the trigger ("Order view"). */
  label: string
  /** Formats a count (locale digits and separators). */
  formatCount: (n: number) => string
  /** Filters are applied: the trigger reads "Custom" with the result count, no view is ticked. */
  custom?: { label: string; count: number } | undefined
}

/** The radio value for a view; `null` (the "all" view) travels as an empty string. */
function keyOf(value: string | null): string {
  return value ?? ''
}

/**
 * Figma "Table / View select": the table toolbar's first control. The current view's name with
 * its count and an up-down chevron; the menu lists every view with its count on the right.
 */
export default function ViewSelect<V extends string | null>({
  value,
  options,
  onChange,
  label,
  formatCount,
  custom,
}: ViewSelectProps<V>) {
  // Hooks
  const tableCopy = useCopy(tableContent)

  // Render logic
  const found = options.find((o) => o.value === value) ?? options[0]
  const current = custom ? { value: null, label: custom.label, count: custom.count } : found

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={label}
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-sm pr-2 pl-2.5 text-body font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted"
      >
        {current?.label}
        {current?.count !== undefined ? (
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            {formatCount(current.count)}
          </span>
        ) : null}
        <ChevronsUpDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </DropdownMenuTrigger>
      {/* Figma "State · Views dropdown open": a "Views" heading, the tick on the left and the
          count on the right of each view. */}
      <DropdownMenuContent align="start" className="min-w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{tableCopy.views}</DropdownMenuLabel>
          {options.map((o) => {
            const on = !custom && keyOf(o.value) === keyOf(found?.value ?? null)
            return (
              <DropdownMenuItem key={keyOf(o.value)} onClick={() => onChange(o.value)}>
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {on ? <CheckIcon className="size-4" aria-hidden="true" /> : null}
                </span>
                <span className={on ? 'flex-1 font-medium' : 'flex-1'}>{o.label}</span>
                {o.count !== undefined ? (
                  <span className="ml-4 text-xs text-muted-foreground tabular-nums">
                    {formatCount(o.count)}
                  </span>
                ) : null}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
