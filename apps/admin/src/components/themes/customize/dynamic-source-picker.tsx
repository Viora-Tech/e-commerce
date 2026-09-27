'use client'

import { optionsFor, type SettingKind, type SourceOption } from '@commerce/core/dynamic-sources'
import type { TemplateKey } from '@commerce/core/theme'
import { CheckIcon, DynamicSource, Search } from '@commerce/ui/icons'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { dynamicSourcesContent as copy } from '@/data/dynamic-sources'
import { loadCatalog, optionParts } from '@/lib/dynamic-sources'

type DynamicSourcePickerProps = {
  kind: SettingKind
  template: TemplateKey
  /** The source the setting reads now, ticked in the list. */
  current: string | null
  onPick: (path: string) => void
  onClose: () => void
}

type Group = { heading: string; items: { path: string; label: string }[] }

/** Picker rows under one heading each: "Product", "Store", "FAQ › Shipping". */
function groupOptions(options: readonly SourceOption[], query: string): Group[] {
  const q = query.trim().toLowerCase()
  const groups: Group[] = []
  for (const option of options) {
    const parts = optionParts(option)
    const label = parts.at(-1) ?? option.path
    const heading = parts.slice(0, -1).filter(Boolean).join(' › ')
    if (q && !`${heading} ${label}`.toLowerCase().includes(q)) continue
    const last = groups.at(-1)
    if (last?.heading === heading) last.items.push({ path: option.path, label })
    else groups.push({ heading, items: [{ path: option.path, label }] })
  }
  return groups
}

/**
 * "Connect dynamic source": the store data this setting can show, one tap to
 * pick. Only sources of a fitting type are listed (an image setting sees image
 * sources only), grouped the way the merchant thinks of them.
 */
export default function DynamicSourcePicker({
  kind,
  template,
  current,
  onPick,
  onClose,
}: DynamicSourcePickerProps) {
  // Hooks
  const [catalog, setCatalog] = useState<SourceOption[] | 'loading' | 'failed'>('loading')
  const [query, setQuery] = useState('')

  useEffect(() => {
    let active = true
    loadCatalog(template).then(
      (next) => active && setCatalog(next),
      () => active && setCatalog('failed'),
    )
    return () => {
      active = false
    }
  }, [template])

  // Render logic
  const options = Array.isArray(catalog) ? optionsFor(catalog, kind) : []
  const groups = groupOptions(options, query)

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[85svh] flex-col gap-3 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.intro[kind]}</DialogDescription>
        </DialogHeader>
        {options.length > 6 ? (
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.search}
              aria-label={copy.search}
              className="rounded-xl pl-9"
              autoFocus
            />
          </div>
        ) : null}
        <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
          {catalog === 'loading' ? (
            <p className="flex items-center gap-2 py-6 text-body text-muted-foreground">
              <Spinner />
              {copy.loading}
            </p>
          ) : catalog === 'failed' ? (
            <p className="py-6 text-body text-destructive">{copy.failed}</p>
          ) : options.length === 0 ? (
            <div className="flex flex-col gap-1 py-6">
              <p className="text-body text-foreground">{copy.empty}</p>
              <p className="text-caption text-muted-foreground">{copy.emptyHelp}</p>
            </div>
          ) : groups.length === 0 ? (
            <p className="py-6 text-body text-muted-foreground">{copy.noMatch}</p>
          ) : (
            groups.map((group) => (
              <section key={group.heading} className="flex flex-col gap-0.5 pb-3">
                <h3 className="px-2 pb-1 text-caption font-medium text-muted-foreground">
                  {group.heading}
                </h3>
                {group.items.map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => onPick(item.path)}
                    aria-pressed={item.path === current}
                    className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-body text-foreground hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <DynamicSource aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.path === current ? (
                      <CheckIcon aria-hidden className="size-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                ))}
              </section>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
