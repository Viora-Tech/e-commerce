import { useEffect, useState } from 'react'
import { DEFAULT_HIDDEN } from './bulk-edit-columns'

const STORAGE_KEY = 'products-bulk-edit:hidden-columns'

/**
 * The columns the person switched off in the Columns menu, remembered in this browser. It starts
 * from the defaults on the server and first paint, then picks up the saved choice. The customers
 * sheet passes its own storage key and defaults (#1000).
 */
export function useHiddenColumns(
  storageKey: string = STORAGE_KEY,
  defaults: readonly string[] = DEFAULT_HIDDEN,
) {
  // Hooks
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(defaults))

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      const parsed: unknown = saved ? JSON.parse(saved) : null
      if (Array.isArray(parsed)) setHidden(new Set(parsed.filter((k) => typeof k === 'string')))
    } catch {
      /* Storage can be blocked; the defaults are fine. */
    }
  }, [storageKey])

  // Event handlers
  const toggle = (key: string, shown: boolean) => {
    const next = new Set(hidden)
    if (shown) next.delete(key)
    else next.add(key)
    setHidden(next)
    try {
      window.localStorage.setItem(storageKey, JSON.stringify([...next]))
    } catch {
      /* Not remembered this time; the sheet still changes. */
    }
  }

  return { hidden, toggle }
}
