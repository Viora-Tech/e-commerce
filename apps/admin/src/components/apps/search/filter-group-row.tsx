'use client'

import { ArrowDown, ArrowUp, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { searchFiltersContent } from '@/data/search-filters'
import { useCopy } from '@/hooks/use-copy'

type FilterGroupRowProps = {
  id: string
  name: string
  detail: string
  label: string
  first: boolean
  last: boolean
  onLabel: (label: string) => void
  onMove: (by: -1 | 1) => void
  onRemove: () => void
}

/** One filter in the list: its source, the name shoppers see, and move and remove buttons. */
export default function FilterGroupRow({
  id,
  name,
  detail,
  label,
  first,
  last,
  onLabel,
  onMove,
  onRemove,
}: FilterGroupRowProps) {
  // Hooks
  const { list: copy } = useCopy(searchFiltersContent)

  // Render logic
  const inputId = `filter-label-${id}`

  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-ink-strong">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{detail}</span>
      </div>
      <label htmlFor={inputId} className="sr-only">
        {copy.labelFor(name)}
      </label>
      <Input
        id={inputId}
        value={label}
        maxLength={60}
        placeholder={copy.labelPlaceholder}
        onChange={(e) => onLabel(e.target.value)}
        className="sm:w-56"
      />
      <div className="flex shrink-0 items-center gap-1 self-end sm:self-auto">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={first}
          aria-label={copy.moveUp(name)}
          onClick={() => onMove(-1)}
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={last}
          aria-label={copy.moveDown(name)}
          onClick={() => onMove(1)}
        >
          <ArrowDown aria-hidden="true" />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={copy.remove(name)} onClick={onRemove}>
          <Trash2 aria-hidden="true" />
        </Button>
      </div>
    </li>
  )
}
