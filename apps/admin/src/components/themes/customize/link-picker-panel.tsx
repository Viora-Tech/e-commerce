'use client'

import { ChevronLeftIcon, Search } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { type KeyboardEvent, useEffect, useState } from 'react'
import { customizeContent } from '@/data/customize'
import {
  type GroupedTargets,
  readRecentLinks,
  rememberLink,
  searchAllLinkTargets,
  searchLinkTargets,
} from '@/lib/customize-link-targets'
import {
  LINK_KINDS,
  type LinkKind,
  linkKindOf,
  normalisePastedUrl,
  type RecentLink,
} from '@/lib/customize-links'
import LinkPasteForm from './link-paste-form'
import LinkTargetRows, { type LinkRow } from './link-target-rows'

type LinkPickerPanelProps = {
  /** The href currently stored, to mark the matching row. */
  value: string
  onPick: (href: string) => void
  newTab?: boolean | undefined
  onNewTab?: ((value: boolean) => void) | undefined
}

type Load = { state: 'loading' } | { state: 'failed' } | { state: 'done'; groups: GroupedTargets }

const copy = customizeContent.link

const SEARCH_DELAY_MS = 180

/** A typed query that reads as a web address, offered as "Use …" above the results. */
function pastedFrom(query: string): string | null {
  const q = query.trim()
  if (!q || (!q.includes('.') && !q.startsWith('/') && !q.includes(':'))) return null
  return normalisePastedUrl(q)
}

/**
 * The link picker's popover body, Shopify-style. One search box: empty, it
 * shows recent picks, the home page and each kind of target to browse into;
 * typed, it searches every kind at once. Opening a kind drills into it with
 * its own search. "Paste a link" and the new-tab switch sit at the bottom.
 */
export default function LinkPickerPanel({ value, onPick, newTab, onNewTab }: LinkPickerPanelProps) {
  // Hooks
  const reducedMotion = useReducedMotion()
  const [kind, setKind] = useState<LinkKind | null>(null)
  const [query, setQuery] = useState('')
  const [load, setLoad] = useState<Load>({ state: 'done', groups: [] })
  const [recent] = useState<RecentLink[]>(() => readRecentLinks())
  useEffect(() => {
    let active = true
    if (!kind && !query.trim()) {
      setLoad({ state: 'done', groups: [] })
      return
    }
    setLoad({ state: 'loading' })
    const timer = setTimeout(() => {
      const search = kind
        ? searchLinkTargets(kind, query).then((items) => [{ kind, items }])
        : searchAllLinkTargets(query)
      search.then(
        (groups) => active && setLoad({ state: 'done', groups }),
        () => active && setLoad({ state: 'failed' }),
      )
    }, SEARCH_DELAY_MS)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [kind, query])

  // Helpers
  const rowsOf = (groupKind: LinkKind): LinkRow[] =>
    load.state === 'done'
      ? (load.groups.find((g) => g.kind === groupKind)?.items ?? []).map((target) => ({
          type: 'target',
          target,
        }))
      : []

  // Event handlers
  const handlePick = (href: string, title: string, pickedKind: RecentLink['kind']) => {
    rememberLink({ href, title, kind: pickedKind })
    onPick(href)
  }

  const handleOpenKind = (next: LinkKind | null) => {
    setKind(next)
    setQuery('')
  }

  // Arrow keys move between rows; from the search box, Down enters the list.
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
    if ((e.target as HTMLElement).closest('form')) return
    const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-link-row]')]
    if (rows.length === 0) return
    e.preventDefault()
    const at = rows.indexOf(document.activeElement as HTMLElement)
    const next = e.key === 'ArrowDown' ? Math.min(at + 1, rows.length - 1) : at - 1
    if (next < 0) e.currentTarget.querySelector<HTMLInputElement>('input')?.focus()
    else rows[next]?.focus()
  }

  // Render logic
  const browsing = !kind && !query.trim()
  const pasted = kind ? null : pastedFrom(query)
  const noResults =
    !browsing && load.state === 'done' && load.groups.every((g) => g.items.length === 0)

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: arrow-key roving between the buttons inside.
    <div className="flex flex-col" onKeyDown={handleKeyDown}>
      <div className="flex items-center gap-1 p-2">
        {kind ? (
          <button
            type="button"
            onClick={() => handleOpenKind(null)}
            aria-label={copy.back}
            title={copy.back}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ChevronLeftIcon aria-hidden className="size-4" />
          </button>
        ) : null}
        <div className="relative flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={kind ? copy.searchIn(copy.tabs[kind]) : copy.search}
            aria-label={kind ? copy.searchIn(copy.tabs[kind]) : copy.search}
            className="h-8 rounded-lg pl-8 text-[0.8125rem]"
          />
        </div>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={kind ?? 'root'}
          initial={reducedMotion ? false : { opacity: 0, x: kind ? 8 : -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, x: kind ? -8 : 8 }}
          transition={{ duration: reducedMotion ? 0 : 0.15, ease: 'easeOut' }}
          className="flex h-64 flex-col gap-1 overflow-y-auto px-1.5 pb-1.5"
        >
          {pasted ? (
            <LinkTargetRows
              rows={[
                {
                  type: 'recent',
                  recent: { href: pasted, title: pasted, kind: linkKindOf(pasted) ?? 'url' },
                },
              ]}
              value={value}
              onPick={handlePick}
              onOpenKind={handleOpenKind}
            />
          ) : null}
          {browsing ? (
            <>
              <LinkTargetRows
                heading={copy.recent}
                rows={recent.map((r) => ({ type: 'recent', recent: r }))}
                value={value}
                onPick={handlePick}
                onOpenKind={handleOpenKind}
              />
              <LinkTargetRows
                heading={copy.browse}
                rows={[
                  { type: 'home' },
                  ...LINK_KINDS.map((k) => ({ type: 'kind' as const, kind: k })),
                ]}
                value={value}
                onPick={handlePick}
                onOpenKind={handleOpenKind}
              />
            </>
          ) : null}
          {!browsing && load.state === 'loading' ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">{copy.loading}</p>
          ) : null}
          {load.state === 'failed' ? (
            <p className="px-2 py-3 text-xs text-destructive">{copy.failed}</p>
          ) : null}
          {noResults && !pasted ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">{copy.empty}</p>
          ) : null}
          {!browsing
            ? (kind ? [kind] : LINK_KINDS).map((k) => (
                <LinkTargetRows
                  key={k}
                  heading={kind ? undefined : copy.tabs[k]}
                  rows={rowsOf(k)}
                  value={value}
                  onPick={handlePick}
                  onOpenKind={handleOpenKind}
                />
              ))
            : null}
        </motion.div>
      </AnimatePresence>
      <LinkPasteForm
        onPick={(href) => handlePick(href, href, linkKindOf(href) ?? 'url')}
        newTab={newTab}
        onNewTab={onNewTab}
      />
    </div>
  )
}
