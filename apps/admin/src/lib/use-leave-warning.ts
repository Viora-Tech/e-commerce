'use client'

import { useEffect, useRef } from 'react'

/**
 * The browser's "Leave site?" question while `unsaved()` says something would be lost. The
 * latest `unsaved` is read when the page is closing, so it may read refs.
 */
export function useLeaveWarning(unsaved: () => boolean): void {
  const latest = useRef(unsaved)
  latest.current = unsaved

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current()) event.preventDefault()
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
}
