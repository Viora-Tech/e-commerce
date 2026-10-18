import { useEffect, useState } from 'react'
import { DEFAULT_HIDDEN } from './bulk-edit-columns'

const STORAGE_KEY = 'products-bulk-edit:hidden-columns'

/**
 * The columns the person switched off in the Columns menu, remembered in this browser. It starts
 * from the defaults on the server and first paint, then picks up the saved choice.
 */
export function useHiddenColumns() {
  // Hooks
  const [hidden, setHidden] = useState<Set<string>>(new Set(DEFAULT_HIDDEN))

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY)
      const parsed: unknown = saved ? JSON.parse(saved) : null
      if (Array.isArray(parsed)) setHidden(new Set(parsed.filter((k) => typeof k === 'string')))
    } catch {
      /* Storage can be blocked; the defaults are fine. */
    }
  }, [])

  // Event handlers
  const toggle = (key: string, shown: boolean) => {
    const next = new Set(hidden)
    if (shown) next.delete(key)
    else next.add(key)
    setHidden(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
    } catch {
      /* Not remembered this time; the sheet still changes. */
    }
  }

  return { hidden, toggle }
}
