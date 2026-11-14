'use client'

import { useState } from 'react'

/**
 * Every value `current` has had so far, in the order first seen (the tabs a page has opened).
 * A tab panel rendered only once visited loads its data when first opened, then stays mounted.
 */
export function useVisited(current: string): readonly string[] {
  const [seen, setSeen] = useState<readonly string[]>([current])
  // Derived during render (React's "storing information from previous renders"), no effect.
  if (!seen.includes(current)) setSeen([...seen, current])
  return seen.includes(current) ? seen : [...seen, current]
}
