'use client'

import { ChevronDown, Package, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@commerce/ui/shadcn/command'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { FIELD_CONTROL } from '@/lib/customize-field-styles'
import { searchLinkTargets } from '@/lib/customize-link-targets'
import type { LinkTarget } from '@/lib/customize-links'

type ProductHandleFieldProps = {
  id?: string | undefined
  value: string | undefined
  onChange: (handle: string) => void
  readOnly?: boolean | undefined
}

const copy = customizeContent.productPicker

/** `/products/<handle>` → `<handle>`. */
const handleOf = (target: LinkTarget) =>
  decodeURIComponent(target.href.replace(/^\/products\//, ''))

/**
 * Picks one product for the Product card element: a searchable list of the
 * store's products (the link picker's product search), stored as its handle.
 */
export default function ProductHandleField({
  id,
  value,
  onChange,
  readOnly,
}: ProductHandleFieldProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<LinkTarget[] | null>(null)
  const [current, setCurrent] = useState<LinkTarget | null>(null)

  useEffect(() => {
    if (!open) return
    let active = true
    setResults(null)
    searchLinkTargets('product', query)
      .then((rows) => active && setResults(rows))
      .catch(() => active && setResults([]))
    return () => {
      active = false
    }
  }, [open, query])

  useEffect(() => {
    if (!value) return setCurrent(null)
    let active = true
    searchLinkTargets('product', value)
      .then((rows) => active && setCurrent(rows.find((r) => handleOf(r) === value) ?? null))
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [value])

  // Event handlers
  const handlePick = (target: LinkTarget) => {
    onChange(handleOf(target))
    setCurrent(target)
    setOpen(false)
  }

  // Render logic
  const label = current?.title ?? value ?? ''

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          disabled={readOnly}
          className={cn(
            FIELD_CONTROL,
            'flex min-w-0 flex-1 items-center gap-2 border border-input bg-card text-left hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:outline-none',
          )}
        >
          {current?.imageUrl ? (
            <span className="relative size-5 shrink-0 overflow-hidden rounded">
              <Image src={current.imageUrl} alt="" fill sizes="1.25rem" className="object-cover" />
            </span>
          ) : (
            <Package
              aria-hidden
              weight="regular"
              className="size-3.5 shrink-0 text-muted-foreground"
            />
          )}
          <span className={cn('min-w-0 flex-1 truncate', !label && 'text-muted-foreground')}>
            {label || copy.placeholder}
          </span>
          <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 gap-0 p-0">
          <Command shouldFilter={false}>
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={copy.search}
              aria-label={copy.search}
            />
            <CommandList>
              {results === null ? (
                <p className="px-3 py-4 text-xs text-muted-foreground">{copy.loading}</p>
              ) : (
                <CommandEmpty>{copy.empty}</CommandEmpty>
              )}
              {(results ?? []).map((target) => (
                <CommandItem key={target.id} value={target.id} onSelect={() => handlePick(target)}>
                  {target.imageUrl ? (
                    <span className="relative size-6 shrink-0 overflow-hidden rounded">
                      <Image
                        src={target.imageUrl}
                        alt=""
                        fill
                        sizes="1.5rem"
                        className="object-cover"
                      />
                    </span>
                  ) : (
                    <Package aria-hidden weight="regular" className="size-3.5" />
                  )}
                  <span className="truncate">{target.title}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && !readOnly ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={copy.clear}
          title={copy.clear}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : null}
    </div>
  )
}
