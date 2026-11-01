'use client'

import { POLICY_TITLES, POLICY_TYPES } from '@commerce/core/policies'
import { CheckIcon, Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { menusContent, type NavigationItemType } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type DestinationPickerProps = {
  type: Exclude<NavigationItemType, 'home' | 'url' | 'search' | 'collections'>
  selectedValue?: string
  onSelect: (value: string, title: string) => void
}

type Candidate = { value: string; title: string }

async function loadCandidates(type: DestinationPickerProps['type']): Promise<Candidate[]> {
  if (type === 'policy') {
    // A policy is a page with a fixed handle; only published ones open on the store.
    const pages = await api.pages.list()
    const live = new Set(pages.filter((p) => p.publishedAt).map((p) => p.handle))
    return POLICY_TYPES.filter((t) => live.has(t)).map((t) => ({
      value: t,
      title: pages.find((p) => p.handle === t)?.title ?? POLICY_TITLES[t],
    }))
  }
  if (type === 'blog') {
    const rows = await api.blog.blogs()
    return rows.map((b) => ({ value: b.handle, title: b.title }))
  }
  if (type === 'article') {
    const { rows } = await api.blog.list({ page: 1, perPage: 100, status: 'published' })
    return rows.map((a) => ({ value: `${a.blogHandle}/${a.handle}`, title: a.title }))
  }
  if (type === 'collection') {
    const rows = await api.collections.list()
    return rows
      .filter((c) => c.status === 'active')
      .map((c) => ({ value: c.handle, title: c.title }))
  }
  if (type === 'page') {
    const rows = await api.pages.list()
    return rows.filter((p) => p.publishedAt).map((p) => ({ value: p.handle, title: p.title }))
  }
  const { items } = await api.products.list({ page: 1, perPage: 100, status: 'active' })
  return items.map((p) => ({ value: p.handle, title: p.title }))
}

export default function DestinationPicker({
  type,
  selectedValue,
  onSelect,
}: DestinationPickerProps) {
  // Hooks
  const { item: copy } = useCopy(menusContent)
  const [query, setQuery] = useState('')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadCandidates(type)
      .then((rows) => {
        if (cancelled) return
        setCandidates(rows)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [type])

  // Render logic
  const q = query.trim().toLowerCase()
  const shown = candidates.filter((c) => !q || c.title.toLowerCase().includes(q))

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.searchPlaceholder}
          className="pl-8"
          autoComplete="off"
        />
      </div>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-line">
        {loading ? (
          <p className="px-3 py-4 text-body text-muted-foreground">{copy.searchPlaceholder}…</p>
        ) : shown.length === 0 ? (
          <p className="px-3 py-4 text-body text-muted-foreground">{copy.noResults}</p>
        ) : (
          shown.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => onSelect(c.value, c.title)}
              className={cn(
                'flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-body hover:bg-muted',
                selectedValue === c.value && 'bg-primary-soft',
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                {/* The picked row is ticked, not only tinted (audit #160). */}
                <CheckIcon
                  aria-hidden="true"
                  className={cn(
                    'size-4 shrink-0 text-foreground',
                    selectedValue !== c.value && 'invisible',
                  )}
                />
                <span className="truncate text-foreground">{c.title}</span>
              </span>
              <span className="shrink-0 text-caption text-muted-foreground">/{c.value}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
