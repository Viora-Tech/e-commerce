'use client'

import { POLICY_TITLES, POLICY_TYPES } from '@commerce/core/policies'
import { CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'
import RecordCombobox from '@/components/pickers/record-combobox'
import { menusContent, type NavigationItemType } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
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
  const { data, loading } = useLoad(() => loadCandidates(type), [type])

  // Render logic
  const candidates = data ?? []
  const q = query.trim().toLowerCase()
  const shown = candidates.filter((c) => !q || c.title.toLowerCase().includes(q))

  return (
    <RecordCombobox
      list="panel"
      listClassName="max-h-56"
      placeholder={copy.searchPlaceholder}
      query={query}
      onQueryChange={setQuery}
      items={shown}
      itemKey={(c) => c.value}
      status={loading ? `${copy.searchPlaceholder}…` : shown.length === 0 ? copy.noResults : null}
      isSelected={(c) => selectedValue === c.value}
      onPick={(c) => onSelect(c.value, c.title)}
      renderItem={(c) => (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
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
        </span>
      )}
    />
  )
}
