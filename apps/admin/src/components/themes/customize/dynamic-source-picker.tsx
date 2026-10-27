'use client'

import { optionsFor, type SettingKind, type SourceOption } from '@commerce/core/dynamic-sources'
import type { TemplateKey } from '@commerce/core/theme'
import { DynamicSource, Search, SearchX } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { type KeyboardEvent, useEffect, useId, useState } from 'react'
import { dynamicSourcePickerContent } from '@/data/dynamic-sources'
import { useCopy } from '@/hooks/use-copy'
import { groupSources, sectionPaths, startsOpen } from '@/lib/dynamic-source-groups'
import { loadCatalog, optionParts } from '@/lib/dynamic-sources'
import DynamicSourcePickerGroup from './dynamic-source-picker-group'

type DynamicSourcePickerProps = {
  kind: SettingKind
  template: TemplateKey
  /** The source the setting reads now, ticked in the list. */
  current: string | null
  onPick: (path: string) => void
  onClose: () => void
}

/** A row's own name: "Title", "Care instructions", "Answer". */
const labelOf = (option: SourceOption) => optionParts(option).at(-1) || option.path

/**
 * "Connect dynamic source": the store data this setting can show, one tap to
 * pick. Only sources of a fitting type are listed (an image setting sees image
 * sources only), in folding sections per source type, searchable, and driven
 * from the search box with the arrow keys and Enter.
 */
export default function DynamicSourcePicker({
  kind,
  template,
  current,
  onPick,
  onClose,
}: DynamicSourcePickerProps) {
  // Hooks
  const copy = useCopy(dynamicSourcePickerContent)
  const baseId = useId()
  const [catalog, setCatalog] = useState<SourceOption[] | 'loading' | 'failed'>('loading')
  const [query, setQuery] = useState('')
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  const [active, setActive] = useState<string | null>(current)

  useEffect(() => {
    let alive = true
    loadCatalog(template).then(
      (next) => alive && setCatalog(next),
      () => alive && setCatalog('failed'),
    )
    return () => {
      alive = false
    }
  }, [template])

  // Helpers
  const idOf = (path: string) => `${baseId}-${path}`
  const isOpen = (key: string) => {
    if (query.trim()) return true
    const section = all.find((s) => s.key === key)
    return folded[key] ?? (section ? startsOpen(section, current, all.length) : true)
  }
  const moveTo = (path: string | undefined) => {
    if (!path) return
    setActive(path)
    document.getElementById(idOf(path))?.scrollIntoView({ block: 'nearest' })
  }

  // Event handlers
  const handleQuery = (next: string) => {
    setQuery(next)
    setActive(groupSources(options, labelOf, copy.sections, next).flatMap(sectionPaths)[0] ?? null)
  }
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const at = active ? visible.indexOf(active) : -1
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      moveTo(visible[Math.min(at + 1, visible.length - 1)])
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      moveTo(visible[Math.max(at - 1, 0)])
    } else if (e.key === 'Home' && !query) {
      e.preventDefault()
      moveTo(visible[0])
    } else if (e.key === 'End' && !query) {
      e.preventDefault()
      moveTo(visible.at(-1))
    } else if (e.key === 'Enter' && active && at !== -1) {
      e.preventDefault()
      onPick(active)
    }
  }
  const handleToggle = (key: string) => setFolded((f) => ({ ...f, [key]: !isOpen(key) }))

  // Render logic
  const options = Array.isArray(catalog) ? optionsFor(catalog, kind) : []
  const all = groupSources(options, labelOf, copy.sections)
  const sections = groupSources(options, labelOf, copy.sections, query)
  const visible = sections.filter((s) => isOpen(s.key)).flatMap(sectionPaths)
  const activeId = active && visible.includes(active) ? idOf(active) : undefined
  const listId = `${baseId}-list`

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex h-[min(85svh,40rem)] w-full flex-col gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="gap-3 border-b p-4">
          <DialogTitle className="text-base font-medium">{copy.title}</DialogTitle>
          <DialogDescription className="text-caption text-muted-foreground">
            {copy.intro[kind]}
          </DialogDescription>
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => handleQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={copy.search}
              aria-label={copy.search}
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-autocomplete="list"
              className="pl-8"
              autoFocus
            />
          </div>
        </DialogHeader>

        <div id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
          {catalog === 'loading' ? (
            <p className="flex h-40 items-center justify-center gap-2 text-body text-muted-foreground">
              <Spinner />
              {copy.loading}
            </p>
          ) : catalog === 'failed' ? (
            <p className="flex h-40 items-center justify-center text-body text-destructive">
              {copy.failed}
            </p>
          ) : options.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <DynamicSource aria-hidden className="size-5" />
              </span>
              <p className="text-body-strong text-foreground">{copy.empty}</p>
              <p className="max-w-sm text-caption text-muted-foreground">{copy.emptyHelp}</p>
            </div>
          ) : sections.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <SearchX aria-hidden className="size-5" />
              </span>
              <p className="text-body-strong text-foreground">{copy.noMatch(query.trim())}</p>
              <p className="max-w-sm text-caption text-muted-foreground">{copy.noMatchHelp}</p>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleQuery('')}>
                {copy.clear}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {sections.map((section) => (
                <DynamicSourcePickerGroup
                  key={section.key}
                  section={section}
                  open={isOpen(section.key)}
                  query={query.trim()}
                  current={current}
                  active={active}
                  idOf={idOf}
                  onToggle={() => handleToggle(section.key)}
                  onPick={onPick}
                  onHover={setActive}
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="mx-0 mb-0 items-center gap-2 rounded-b-xl border-t bg-muted/50 px-4 py-3 sm:justify-between">
          <span className="hidden text-caption text-muted-foreground sm:block">{copy.keys}</span>
          <Button type="button" variant="outline" onClick={onClose}>
            {copy.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
