'use client'

import { createContext, useContext } from 'react'

export type WaitlistApi = { openWaitlist: (email?: string) => void }

export const WaitlistContext = createContext<WaitlistApi | null>(null)

export function useWaitlist(): WaitlistApi {
  const api = useContext(WaitlistContext)
  if (!api) throw new Error('useWaitlist must be used inside WaitlistProvider')
  return api
}
