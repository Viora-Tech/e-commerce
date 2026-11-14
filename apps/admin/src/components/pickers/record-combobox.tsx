'use client'

import { cn } from '@commerce/ui/lib/utils'
import { type KeyboardEvent, type ReactNode, useState } from 'react'
import SearchField from '@/components/fields/search-field'

type RecordComboboxProps<T> = {
  /** What the search box holds; the caller searches (remote or local) and passes `items`. */
  query: string
  onQueryChange: (query: string) => void
  items: T[]
  itemKey: (item: T) => string
  /** The row's content; the row button, padding and hover come from here. */
  renderItem: (item: T) => ReactNode
  onPick: (item: T) => void
  /** Tints the row and marks it pressed (the record picked so far). */
  isSelected?: (item: T) => boolean
  /** Rows that cannot be picked (already chosen). */
  isDisabled?: (item: T) => boolean
  /**
   * A line shown in place of the rows: searching, nothing found, failed. `inline` ignores it
   * (the caller shows it under the field).
   */
  status?: ReactNode
  /**
   * `inline`: rows open under the field when there are any (form cards that clip overflow).
   * `panel`: a list box that is always there, with `status` inside it.
   * `popover`: rows float over what is below while the field has focus.
   */
  list?: 'inline' | 'panel' | 'popover'
  /** `popover` only: controlled open state (for callers that only search while it is open). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** `popover` only: Enter picks the first row. */
  enterPicksFirst?: boolean
  id?: string
  name?: string
  placeholder?: string
  /** Defaults to the placeholder. */
  ariaLabel?: string
  disabled?: boolean
  autoFocus?: boolean
  invalid?: boolean
  size?: 'sm' | 'default' | 'lg'
  className?: string
  listClassName?: string
}

const LIST = 'flex flex-col gap-0.5 overflow-y-auto rounded-lg border border-border bg-card p-1'
const ROW =
  'flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-body transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-60 disabled:hover:bg-transparent'

/**
 * The one type-ahead record picker: a SearchField with its matches listed inline, in a fixed
 * panel or in a floating list. Customer, variant, supplier, reference and menu destination
 * pickers all draw their search and rows through it.
 */
export default function RecordCombobox<T>({
  query,
  onQueryChange,
  items,
  itemKey,
  renderItem,
  onPick,
  isSelected,
  isDisabled,
  status,
  list = 'inline',
  open,
  onOpenChange,
  enterPicksFirst,
  id,
  name,
  placeholder,
  ariaLabel,
  disabled,
  autoFocus,
  invalid,
  size,
  className,
  listClassName,
}: RecordComboboxProps<T>) {
  // Hooks
  const [ownOpen, setOwnOpen] = useState(false)

  // Helpers
  const setOpen = (next: boolean) => {
    if (list !== 'popover') return
    setOwnOpen(next)
    onOpenChange?.(next)
  }

  // Event handlers
  const handlePick = (item: T) => {
    setOpen(false)
    onPick(item)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (list !== 'popover') return
    if (e.key === 'Escape') setOpen(false)
    if (e.key === 'Enter' && enterPicksFirst && items[0]) {
      e.preventDefault()
      handlePick(items[0])
    }
  }

  // Render logic
  const isOpen = open ?? ownOpen
  const shown =
    list === 'panel'
      ? true
      : list === 'popover'
        ? isOpen && (Boolean(status) || items.length > 0)
        : items.length > 0
  const showStatus = list !== 'inline' && Boolean(status)
  const popover = list === 'popover'

  return (
    <div className={cn(popover ? 'relative' : 'flex flex-col gap-2', className)}>
      <SearchField
        id={id}
        name={name}
        size={size}
        value={query}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        aria-invalid={invalid ? true : undefined}
        disabled={disabled}
        autoFocus={autoFocus}
        role={popover ? 'combobox' : undefined}
        aria-expanded={popover ? shown : undefined}
        data-1p-ignore
        data-lpignore="true"
        onChange={(e) => {
          onQueryChange(e.target.value)
          setOpen(true)
        }}
        onFocus={popover ? () => setOpen(true) : undefined}
        onBlur={popover ? () => setOpen(false) : undefined}
        onKeyDown={handleKeyDown}
      />
      {shown ? (
        <ul
          className={cn(
            LIST,
            popover
              ? 'absolute inset-x-0 top-full z-20 mt-1 max-h-72 shadow-popover'
              : list === 'inline' && 'max-h-72',
            listClassName,
          )}
        >
          {showStatus ? (
            <li className="px-2 py-2 text-caption text-muted-foreground">{status}</li>
          ) : (
            items.map((item) => {
              const selected = isSelected?.(item) ?? false
              return (
                <li key={itemKey(item)}>
                  <button
                    type="button"
                    disabled={isDisabled?.(item)}
                    aria-pressed={isSelected ? selected : undefined}
                    // Keeps focus in the field, so its blur does not close the list before the click.
                    onMouseDown={popover ? (e) => e.preventDefault() : undefined}
                    onClick={() => handlePick(item)}
                    className={cn(ROW, selected && 'bg-muted')}
                  >
                    {renderItem(item)}
                  </button>
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}
