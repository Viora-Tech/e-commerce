'use client'

import { Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useState } from 'react'
import { menusContent, type NavigationItemType } from '@/data/menus'
import { api } from '@/lib/api-client'

type DestinationPickerProps = {
  type: Exclude<NavigationItemType, 'home' | 'url'>
  selectedValue?: string
  onSelect: (value: string, title: string) => void
}

type Candidate = { value: string; title: string }

const copy = menusContent.item

async function loadCandidates(type: DestinationPickerProps['type']): Promise<Candidate[]> {
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
              <span className="truncate text-foreground">{c.title}</span>
              <span className="shrink-0 text-caption text-muted-foreground">/{c.value}</span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
