'use client'

import { useState } from 'react'
import { matchesAdminFilters } from './filter-utils'
import type { AdminFilterNode, AdminTableFilterField } from './model'

type UseAdminTableFiltersProps<T> = {
  fields: readonly AdminTableFilterField<T>[]
  items: readonly T[]
  matchesSearch: (item: T, normalizedQuery: string) => boolean
  searchQuery: string
}

function useAdminTableFilters<T>({
  fields,
  items,
  matchesSearch,
  searchQuery,
}: UseAdminTableFiltersProps<T>) {
  const [appliedFilters, setAppliedFilters] = useState<AdminFilterNode[]>([])
  const normalizedQuery = searchQuery.trim().toLowerCase()

  const filteredItems = items.filter(
    (item) =>
      matchesSearch(item, normalizedQuery) && matchesAdminFilters(item, appliedFilters, fields),
  )

  return {
    appliedFilters,
    filteredItems,
    hasActiveFilters: appliedFilters.length > 0,
    setAppliedFilters,
  }
}

export { useAdminTableFilters }
