'use client'

import { createContext, useContext } from 'react'

/** Optional starting values: the hero email field, or the category typed into the hero prompt. */
export type WaitlistPrefill = { email?: string; sell?: string }

export type WaitlistApi = { openWaitlist: (prefill?: WaitlistPrefill | string) => void }

export const WaitlistContext = createContext<WaitlistApi | null>(null)

export function useWaitlist(): WaitlistApi {
  const api = useContext(WaitlistContext)
  if (!api) throw new Error('useWaitlist must be used inside WaitlistProvider')
  return api
}
