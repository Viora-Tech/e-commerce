'use client'

/**
 * Shared load/error/total/selection state for admin list pages.
 * Caller supplies fetchPage + deps; refresh reads the latest fetchPage via ref.
 */
import { type DependencyList, useEffect, useRef, useState } from 'react'

type EntityListPage<TItem> = {
  items: TItem[]
  total: number
}

type UseEntityListArgs<TItem> = {
  deps: DependencyList
  fetchPage: () => Promise<EntityListPage<TItem>>
}

export function useEntityList<TItem>(args: UseEntityListArgs<TItem>) {
  const [items, setItems] = useState<TItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // WHY: keep fetchPage current for refresh/bulk without listing it as an effect dep.
  const fetchPageRef = useRef(args.fetchPage)
  fetchPageRef.current = args.fetchPage

  const refresh = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await fetchPageRef.current()
      setItems(result.items)
      setTotalCount(result.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backend request failed')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // Caller owns when to reload via deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional deps list
  }, args.deps)

  const handleBulkDone = () => {
    setSelectedIds(new Set())
    void refresh()
  }

  return {
    error,
    handleBulkDone,
    items,
    loading,
    refresh: () => void refresh(),
    selectedIds,
    setSelectedIds,
    totalCount,
  }
}
