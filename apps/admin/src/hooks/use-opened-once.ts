'use client'

import { useState } from 'react'

/**
 * True from the first time `open` is true, and from then on. A dialog or tab rendered only once
 * it has been opened loads its code (`next/dynamic`) and its data on first use, not with the
 * page; it then stays mounted so it keeps its state and its close animation still plays.
 */
export function useOpenedOnce(open: boolean): boolean {
  const [opened, setOpened] = useState(open)
  // Derived during render (React's "storing information from previous renders"), no effect.
  if (open && !opened) setOpened(true)
  return opened || open
}
