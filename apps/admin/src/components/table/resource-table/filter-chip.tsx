'use client'

import { ChevronDown, X } from '@commerce/ui/icons'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import {
  chipFor,
  clearGroup,
  FilterControl,
  type FilterGroup,
} from '@/components/table/filter-panel'
import { filterPanelContent } from '@/data/filter-panel'
import { tableContent } from '@/data/table'
import { useCopy } from '@/hooks/use-copy'

type FilterChipProps = {
  group: FilterGroup
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * One applied filter as a pill ("Payment is Paid ×"). Clicking it opens a small popover with
 * just that filter's controls; changes apply at once. A filter just picked from the menu shows
 * as a bare name until it is set.
 */
export default function FilterChip({ group, open, onOpenChange }: FilterChipProps) {
  // Hooks
  const panelCopy = useCopy(filterPanelContent)
  const tableCopy = useCopy(tableContent)

  // Render logic
  const chip = chipFor(group, panelCopy)

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <span className="inline-flex h-7 max-w-full items-center rounded-full border border-border bg-muted/60 text-xs text-foreground">
        <PopoverTrigger
          render={
            <button
              type="button"
              className="inline-flex h-full min-w-0 items-center gap-1 rounded-full pl-2.5 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-foreground/5"
            />
          }
          nativeButton
        >
          {chip ? (
            <>
              <span className="shrink-0 text-muted-foreground">
                {tableCopy.filterIs(group.label)}
              </span>
              <span className="truncate pr-1 font-medium">{chip.label}</span>
            </>
          ) : (
            <>
              <span className="truncate text-muted-foreground">{group.label}</span>
              <ChevronDown aria-hidden="true" className="mr-2 size-3 shrink-0" />
            </>
          )}
        </PopoverTrigger>
        {chip ? (
          <button
            type="button"
            onClick={chip.onRemove}
            className="mr-1 flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
            aria-label={tableCopy.removeFilter(chip.label)}
          >
            <X className="size-3" />
          </button>
        ) : null}
      </span>
      <PopoverContent
        align="start"
        className="max-h-[min(28rem,var(--available-height))] w-72 gap-0 overflow-y-auto p-0"
      >
        <div className="flex h-10 shrink-0 items-center justify-between border-border border-b px-3.5">
          <p className="text-xs font-medium text-muted-foreground">{group.label}</p>
          {chip ? (
            <button
              type="button"
              onClick={() => clearGroup(group)}
              className="-mr-1.5 rounded-sm px-1.5 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              {panelCopy.clear}
            </button>
          ) : null}
        </div>
        <div className="px-3.5 py-3">
          <FilterControl group={group} />
        </div>
      </PopoverContent>
    </Popover>
  )
}
