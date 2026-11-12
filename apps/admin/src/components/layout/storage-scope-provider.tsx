'use client'

import { type ReactNode, useEffect } from 'react'
import { dropLegacyUnscopedKeys, StorageScopeContext } from '@/lib/storage-scope'

type StorageScopeProviderProps = {
  /** The active store; null before one is picked (nothing store-specific is then stored). */
  storeId: string | null
  /** The signed-in member. */
  userId: string
  children: ReactNode
}

/**
 * Tells browser-storage helpers which store and member they are keeping data for, and clears the
 * old unscoped keys once (their store is unknown, so they are never carried over).
 */
export default function StorageScopeProvider({
  storeId,
  userId,
  children,
}: StorageScopeProviderProps) {
  // Hooks
  useEffect(() => {
    dropLegacyUnscopedKeys()
  }, [])

  // Render logic
  const scope = storeId ? { storeId, userId } : null

  return <StorageScopeContext.Provider value={scope}>{children}</StorageScopeContext.Provider>
}
