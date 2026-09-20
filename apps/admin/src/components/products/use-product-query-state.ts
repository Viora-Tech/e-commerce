'use client'

import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'

const statusValues = ['draft', 'active', 'archived'] as const

/** URL query state for the products list: search, page, limit, status. */
export function useProductQueryState() {
  return useQueryStates(
    {
      search: parseAsString.withDefault(''),
      page: parseAsInteger.withDefault(1),
      limit: parseAsInteger.withDefault(25),
      status: parseAsStringLiteral(statusValues),
    },
    { shallow: true },
  )
}
