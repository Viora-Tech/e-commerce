'use client'

import { ChevronsUpDown, ExternalLink, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { useEffect, useState } from 'react'
import { customizeContent } from '@/data/customize'
import { LINK_KIND_ICONS } from '@/lib/customize-link-icons'
import { findLinkTarget } from '@/lib/customize-link-targets'
import { parseHref } from '@/lib/customize-links'
import LinkPickerPanel from './link-picker-panel'

type LinkPickerProps = {
  value: string | undefined
  onChange: (href: string) => void
  id?: string | undefined
  readOnly?: boolean | undefined
  /** Link objects (`{ label, href, newTab }`) pass these; a bare href field has nowhere to keep it. */
  newTab?: boolean | undefined
  onNewTab?: ((value: boolean) => void) | undefined
}

const copy = customizeContent.link

/**
 * Shopify's link field: the chosen link as a chip (its type's glyph, its
 * title such as a product's name, and its type), a clear button, and a
 * popover to pick something else. Stores the storefront path
 * (`/products/<handle>` …) as the plain `href` string, so blocks and old docs
 * need no change. The data shape is documented in `lib/customize-links.ts`.
 */
export default function LinkPicker({
  value,
  onChange,
  id,
  readOnly,
  newTab,
  onNewTab,
}: LinkPickerProps) {
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
          ? parsed.url.replace(/^https?:\/\//, '')
          : (title ?? parsed.handle)

  return (
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          disabled={readOnly}
          aria-label={empty ? copy.open : `${copy.open}: ${shown}, ${copy.kinds[kindKey]}`}
          className="flex min-h-9 w-full items-center gap-2 rounded-lg border border-input bg-card py-1 pr-8 pl-1 text-left text-[0.8125rem] transition-colors duration-150 hover:border-border-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50 data-[popup-open]:border-ring"
        >
          {empty ? (
            <>
              <span className="flex size-6 shrink-0 items-center justify-center text-muted-foreground">
                <Icon aria-hidden weight="regular" className="size-3.5" />
              </span>
              <span className="flex-1 truncate text-muted-foreground">{shown}</span>
              <ChevronsUpDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            </>
          ) : (
            <span className="flex max-w-full min-w-0 items-center gap-1.5 rounded-md bg-muted py-0.5 pr-2 pl-1">
              <span className="flex size-5 shrink-0 items-center justify-center rounded bg-card text-foreground">
                <Icon aria-hidden weight="regular" className="size-3.5" />
              </span>
              <span className="min-w-0 truncate font-medium">{shown}</span>
              <span className="shrink-0 text-[0.6875rem] text-muted-foreground tabular-nums">
                {copy.kinds[kindKey]}
              </span>
              {newTab ? (
                <ExternalLink
                  aria-label={copy.newTab}
                  className="size-3 shrink-0 text-muted-foreground"
                />
              ) : null}
            </span>
          )}
        </PopoverTrigger>
        <PopoverContent align="start" side="bottom" className="w-80 gap-0 p-0">
          <LinkPickerPanel value={href} onPick={handlePick} newTab={newTab} onNewTab={onNewTab} />
        </PopoverContent>
      </Popover>
      {empty || readOnly ? null : (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={copy.clear}
          title={copy.clear}
          className={cn(
            'absolute top-1/2 right-1.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground',
          )}
        >
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </div>
  )
}
