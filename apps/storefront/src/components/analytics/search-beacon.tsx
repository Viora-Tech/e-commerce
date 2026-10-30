'use client'

import { useEffect } from 'react'
import { sendDiscoveryEvent } from '@/lib/discovery-beacon'

type SearchBeaconProps = {
  /** The search as the shopper typed it; the server normalises it. */
  query: string
  /** Products the search found. */
  results: number
}

/**
 * Tells the Search & discovery app's Overview that a search ran and how many products it found,
 * once per search (a new sort or page of the same words does not count again). Runs after the
 * page has painted and sends a beacon, so the results never wait on it.
 */
export default function SearchBeacon({ query, results }: SearchBeaconProps) {
  // Hooks
  // One event per search: the words are the trigger; a new count for the same words is not.
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-run only when the words change
  useEffect(() => {
    if (!query.trim()) return
    sendDiscoveryEvent({ kind: 'search', query, results })
  }, [query])

  // Render logic
  return null
}
