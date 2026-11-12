'use client'

import { useState } from 'react'

/**
 * A value the bulk edit popup edits for one order. It starts at `initial` and goes back to a
 * fresh `initial` whenever the popup moves to another order (state adjusted during render, not
 * in an effect).
 */
export function useChoiceForOrder<T>(
  orderId: string | null,
  initial: () => T,
): [T, (next: T) => void] {
  const [choice, setChoice] = useState<T>(initial)
  const [shownFor, setShownFor] = useState(orderId)
  if (shownFor !== orderId) {
    setShownFor(orderId)
    setChoice(initial())
  }
  return [choice, setChoice]
}
