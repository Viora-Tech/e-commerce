'use client'

import { ChevronsUpDown, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { useEffect, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { findLinkTarget } from '@/lib/customize-link-targets'
import { parseHref } from '@/lib/customize-links'
import LinkPickerPanel, { LINK_KIND_ICONS } from './link-picker-panel'

type LinkPickerProps = {
  value: string | undefined
  onChange: (href: string) => void
  id?: string | undefined
  readOnly?: boolean | undefined
}

const copy = customizeContent.link

/**
 * Shopify's link field: one button showing what the link points at (a
 * product's title with a product glyph, "Home page", or the pasted address),
 * a clear button, and a searchable popover to pick something else. Stores
 * the storefront path (`/products/<handle>` …) as the plain `href` string, so
 * blocks and old docs need no change.
 */
export default function LinkPicker({ value, onChange, id, readOnly }: LinkPickerProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    const href = value ?? ''
    setTitle(null)
    const parsed = parseHref(href)
    if (parsed.kind === 'empty' || parsed.kind === 'home' || parsed.kind === 'url') return
    findLinkTarget(parsed.kind, parsed.handle, href).then(
      (found) => active && setTitle(found?.title ?? null),
      () => undefined,
    )
    return () => {
      active = false
    }
  }, [value])

  // Event handlers
  const handlePick = (next: string) => {
    onChange(next)
    setOpen(false)
  }

  // Render logic
  const href = value ?? ''
  const parsed = parseHref(href)
  const empty = parsed.kind === 'empty'
  const kindKey = parsed.kind === 'empty' ? 'url' : parsed.kind
  const Icon = LINK_KIND_ICONS[kindKey]
  const shown =
    parsed.kind === 'empty'
      ? copy.placeholder
      : parsed.kind === 'home'
        ? copy.home
        : parsed.kind === 'url'
          ? parsed.url
          : (title ?? href)
  const hint = empty ? null : copy.kinds[kindKey]

  return (
    <div className="group/link relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          disabled={readOnly}
          aria-label={empty ? copy.open : `${copy.open}: ${shown}`}
          className={cn(
            'flex h-9 w-full items-center gap-2 rounded-lg border border-input bg-card pr-8 pl-2 text-left text-[0.8125rem] transition-colors hover:border-border-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50',
          )}
        >
          <span
            className={cn(
              'flex size-5 shrink-0 items-center justify-center rounded-md',
              empty ? 'text-muted-foreground' : 'bg-muted text-foreground',
            )}
          >
            <Icon aria-hidden weight="light" className="size-3.5" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className={cn('truncate', empty && 'text-muted-foreground')}>{shown}</span>
          </span>
          {hint ? (
            <span className="shrink-0 text-[0.6875rem] text-muted-foreground">{hint}</span>
          ) : null}
          {empty ? (
            <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          ) : null}
        </PopoverTrigger>
        <PopoverContent align="start" side="bottom" className="w-80 gap-0 p-0">
          <LinkPickerPanel value={href} onPick={handlePick} />
        </PopoverContent>
      </Popover>
      {empty || readOnly ? null : (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={copy.clear}
          title={copy.clear}
          className="absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </div>
  )
}
