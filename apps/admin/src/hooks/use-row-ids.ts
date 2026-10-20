'use client'

import { useState } from 'react'

let counter = 0
const nextId = () => {
  counter += 1
  return `row-${counter}`
}

/**
 * Ids for rows that carry none of their own (group rows, a footer column whose menu changes as
 * it is picked), so a drag can follow a row. Rows added or removed elsewhere are matched by
 * count; call `remove` and `reorder` alongside the change so each id stays with its row.
 */
export function useRowIds(count: number) {
  // Hooks
  const [ids, setIds] = useState(() => Array.from({ length: count }, nextId))

  // Render logic
  let current = ids
  if (ids.length !== count) {
    current =
      ids.length > count
        ? ids.slice(0, count)
        : [...ids, ...Array.from({ length: count - ids.length }, nextId)]
    setIds(current)
  }

  return {
    ids: current,
    remove: (index: number) => setIds(current.filter((_, i) => i !== index)),
    reorder: (next: string[]) => setIds(next),
  }
}
