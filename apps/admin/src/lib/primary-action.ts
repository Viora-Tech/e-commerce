'use client'

import { useEffect } from 'react'

/**
 * The current list page's primary "Add …" action, so `N` can jump to it. A page registers
 * its href on mount (`usePrimaryAction`); the last one registered wins, and unmounting clears
 * it, so navigating away from a list page always drops its shortcut.
 */
let currentHref: string | null = null

export function usePrimaryAction(href: string | null): void {
  useEffect(() => {
    currentHref = href
    return () => {
      if (currentHref === href) currentHref = null
    }
  }, [href])
}

export function primaryActionHref(): string | null {
  return currentHref
}
