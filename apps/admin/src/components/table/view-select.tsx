'use client'

import { ChevronsUpDown } from '@commerce/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'

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

/** No view is ticked while filters make a custom one. */
const CUSTOM = '__custom'

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
  // Event handlers
  const handleChange = (next: unknown) => {
    const picked = options.find((o) => keyOf(o.value) === next)
    if (picked) onChange(picked.value)
  }

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
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuRadioGroup
          value={custom ? CUSTOM : keyOf(found?.value ?? null)}
          onValueChange={handleChange}
        >
          {/* Shopify-style: picking a view applies it and closes the menu. */}
          {options.map((o) => (
            <DropdownMenuRadioItem key={keyOf(o.value)} value={keyOf(o.value)} closeOnClick>
              <span className="flex-1">{o.label}</span>
              {o.count !== undefined ? (
                <span className="ml-4 text-xs text-muted-foreground tabular-nums">
                  {formatCount(o.count)}
                </span>
              ) : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
