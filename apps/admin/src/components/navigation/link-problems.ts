'use client'

import { useEffect, useState } from 'react'
import type { MenuItem } from '@/data/menus'
import { api } from '@/lib/api-client'

/** One item whose link is broken or hidden, from `navigation.checkLinks`. */
export type MenuLinkProblem = Awaited<ReturnType<typeof api.navigation.checkLinks>>[number]

const CHECK_DELAY_MS = 400

/**
 * The broken-link check for the menu as it is on screen, keyed by item id. It re-runs a moment
 * after the items change (adding, editing, removing), so a fixed item clears its badge before
 * Save. A failed check shows nothing rather than an error: it is advice, not a gate.
 */
export function useLinkProblems(items: MenuItem[]): Map<string, MenuLinkProblem> {
  const [problems, setProblems] = useState<Map<string, MenuLinkProblem>>(new Map())
  const key = JSON.stringify(items)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the items' content; the array itself changes on every render.
  useEffect(() => {
    let live = true
    const timer = setTimeout(() => {
      api.navigation
        .checkLinks({ items })
        .then((rows) => live && setProblems(new Map(rows.map((r) => [r.itemId, r]))))
        .catch(() => live && setProblems(new Map()))
    }, CHECK_DELAY_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [key])

  return problems
}
