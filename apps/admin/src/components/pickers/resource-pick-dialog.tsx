'use client'

import { CheckIcon, Loader2Icon, Search } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@commerce/ui/shadcn/dialog'
import { Input } from '@commerce/ui/shadcn/input'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { useEffect, useId, useRef, useState } from 'react'
import { resourcePickerContent } from '@/data/resource-picker'
import { useCopy } from '@/hooks/use-copy'
import ResourcePickRow from './resource-pick-row'
import type { PickItem, PickResult, PickTab } from './resource-pick-types'

export type { PickItem, PickPage, PickResult, PickTab } from './resource-pick-types'

type ResourcePickDialogProps = {
  open: boolean
  title: string
  description?: string | undefined
  /** One tab per kind of thing; a single tab hides the tab strip. */
  tabs: PickTab[]
  /** The tab and ids already chosen; the dialog opens on that tab with them ticked. */
  selected: { tab: string; ids: string[] }
  onClose: () => void
  onDone: (result: PickResult) => void
  /** One pick only (a link): ticking a row replaces the last pick, no "select all shown". */
  single?: boolean
}

const SEARCH_DELAY_MS = 250

/**
 * The Browse picker, built like the media "Select file" dialog: tabs, search, a list with
 * thumbnails that loads more as it scrolls, ticks with "select all shown", and a footer that
 * counts the picks. Picks belong to one tab at a time, since a discount (or a rule) points at
 * products or at collections, not a mix.
 */
export default function ResourcePickDialog({
  open,
  title,
  description,
  tabs,
  selected,
  onClose,
  onDone,
  single = false,
}: ResourcePickDialogProps) {
  // Hooks
  const copy = useCopy(resourcePickerContent)
  const allId = useId()
  const [tab, setTab] = useState(selected.tab)
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PickItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [pickTab, setPickTab] = useState(selected.tab)
  const [pickedIds, setPickedIds] = useState<string[]>(selected.ids)
  const [seen, setSeen] = useState<Map<string, PickItem>>(new Map())
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Reset only when the dialog opens; `selected` is a fresh object every parent render.
  // biome-ignore lint/correctness/useExhaustiveDependencies: opening is the trigger
  useEffect(() => {
    if (!open) return
    setTab(selected.tab)
    setPickTab(selected.tab)
    setPickedIds(selected.ids)
    setQuery('')
  }, [open])

  // `tabs` is rebuilt on every parent render, so the loads key on the tab's name, not the object.
  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on tab, see above
  useEffect(() => {
    const active = tabs.find((t) => t.key === tab)
    if (!open || !active) return
    let cancelled = false
    setLoading(true)
    setFailed(false)
    const timer = setTimeout(
      () => {
        active
          .load({ page: 1, search: query.trim() })
          .then((r) => {
            if (cancelled) return
            setItems(r.items)
            setTotal(r.total)
            setPage(1)
            setSeen((prev) => new Map([...prev, ...r.items.map((i) => [i.id, i] as const)]))
          })
          .catch(() => !cancelled && setFailed(true))
          .finally(() => !cancelled && setLoading(false))
      },
      query ? SEARCH_DELAY_MS : 0,
    )
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, tab, query, attempt])

  // biome-ignore lint/correctness/useExhaustiveDependencies: keyed on tab like the load above
  useEffect(() => {
    const active = tabs.find((t) => t.key === tab)
    const sentinel = sentinelRef.current
    if (!open || !active || !sentinel) return
    const hasMore = items.length < total
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || !hasMore || loading || loadingMore) return
        const next = page + 1
        setLoadingMore(true)
        active
          .load({ page: next, search: query.trim() })
          .then((r) => {
            setItems((list) => [
              ...list,
              ...r.items.filter((i) => !list.some((x) => x.id === i.id)),
            ])
            setTotal(r.total)
            setPage(next)
            setSeen((prev) => new Map([...prev, ...r.items.map((i) => [i.id, i] as const)]))
          })
          .catch(() => undefined)
          .finally(() => setLoadingMore(false))
      },
      { rootMargin: '200px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [open, tab, items.length, total, loading, loadingMore, page, query])

  // Helpers
  /** Ticking on another tab starts a fresh pick there. */
  const idsOnTab = (key: string): string[] => (pickTab === key ? pickedIds : [])

  // Event handlers
  const handleTab = (next: unknown) => {
    if (typeof next !== 'string') return
    setTab(next)
    setQuery('')
    setItems([])
  }

  const handleToggle = (item: PickItem, on: boolean) => {
    const base = single ? [] : idsOnTab(tab)
    setPickTab(tab)
    setPickedIds(
      on ? [...base.filter((id) => id !== item.id), item.id] : base.filter((id) => id !== item.id),
    )
  }

  const handleTogglePage = (on: boolean) => {
    const base = idsOnTab(tab)
    const shown = items.map((i) => i.id)
    setPickTab(tab)
    setPickedIds(
      on
        ? [...base, ...shown.filter((id) => !base.includes(id))]
        : base.filter((id) => !shown.includes(id)),
    )
  }

  const handleDone = () => {
    onDone({
      tab: pickTab,
      ids: pickedIds,
      items: pickedIds.map((id) => seen.get(id)).filter((i): i is PickItem => Boolean(i)),
    })
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) onClose()
  }

  // Render logic
  const active = tabs.find((t) => t.key === tab) ?? tabs[0]
  const onTab = idsOnTab(tab)
  const shownPicked = items.filter((i) => onTab.includes(i.id)).length
  const allShown = items.length > 0 && shownPicked === items.length
  const someShown = shownPicked > 0 && !allShown
  const otherTabPicks = pickTab !== tab && pickedIds.length > 0
  const showEmpty = !loading && !failed && items.length === 0

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex h-[min(90svh,40rem)] w-full flex-col gap-0 p-0 sm:max-w-[42rem]">
        <DialogHeader className="gap-3 border-b p-4">
          <DialogTitle className="text-base font-medium">{title}</DialogTitle>
          {description ? (
            <DialogDescription className="text-caption text-muted-foreground">
              {description}
            </DialogDescription>
          ) : null}
          {tabs.length > 1 ? (
            <Tabs value={tab} onValueChange={handleTab}>
              <TabsList>
                {tabs.map((t) => (
                  <TabsTrigger key={t.key} value={t.key}>
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={active?.search}
              aria-label={active?.search}
              className="pl-8"
            />
          </div>
          {otherTabPicks ? (
            <p className="text-caption text-muted-foreground">{copy.oneKind}</p>
          ) : null}
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {items.length > 0 && !loading && !single ? (
            <label
              htmlFor={allId}
              className="sticky top-0 z-10 flex cursor-pointer items-center gap-3 border-b bg-card px-4 py-2 text-caption text-muted-foreground"
            >
              <Checkbox
                id={allId}
                checked={allShown}
                indeterminate={someShown}
                onCheckedChange={(v) => handleTogglePage(Boolean(v))}
              />
              {copy.selectPage}
            </label>
          ) : null}
          {loading ? (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2Icon className="size-5 animate-spin" aria-hidden />
              <span className="sr-only">{copy.loading}</span>
            </div>
          ) : null}
          {failed ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2">
              <p className="text-body-strong">{copy.failed}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAttempt((n) => n + 1)}
              >
                {copy.retry}
              </Button>
            </div>
          ) : null}
          {showEmpty ? (
            <p className="flex h-48 items-center justify-center text-body-strong">
              {active?.empty}
            </p>
          ) : null}
          {!loading && items.length > 0 ? (
            <ul className="flex flex-col divide-y divide-border">
              {items.map((item) => (
                <ResourcePickRow
                  key={item.id}
                  item={item}
                  checked={onTab.includes(item.id)}
                  onToggle={handleToggle}
                />
              ))}
            </ul>
          ) : null}
          <div ref={sentinelRef} className="h-1 shrink-0" />
          {loadingMore ? (
            <div className="flex justify-center py-3 text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" aria-hidden />
            </div>
          ) : null}
        </div>

        <DialogFooter className="mx-0 mb-0 items-center gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:justify-between">
          <span
            className="flex items-center gap-2 text-caption text-muted-foreground"
            aria-live="polite"
          >
            {pickedIds.length > 0 ? copy.selectedCount(pickedIds.length) : null}
            {pickedIds.length > 0 ? (
              <Button type="button" variant="ghost" size="xs" onClick={() => setPickedIds([])}>
                {copy.clear}
              </Button>
            ) : null}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {copy.cancel}
            </Button>
            <Button type="button" onClick={handleDone}>
              <CheckIcon aria-hidden="true" />
              {copy.done}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
