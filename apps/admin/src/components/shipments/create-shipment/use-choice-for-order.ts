'use client'

import { useState } from 'react'

/**
 * The courier picked in the bulk edit popup. It starts at `initial` and goes back to `initial`
 * whenever the popup moves to another order (state adjusted during render, not in an effect).
 */
export function useChoiceForOrder(
  orderId: string | null,
  initial: string | null,
): [string | null, (next: string | null) => void] {
  const [choice, setChoice] = useState<string | null>(initial)
  const [shownFor, setShownFor] = useState(orderId)
  if (shownFor !== orderId) {
    setShownFor(orderId)
    setChoice(initial)
  }
  return [choice, setChoice]
}
