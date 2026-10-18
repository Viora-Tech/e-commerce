'use client'

import { createContext, useContext } from 'react'

export type ConsentApi = { openPreferences: () => void }

export const ConsentContext = createContext<ConsentApi | null>(null)

export function useConsentPreferences(): ConsentApi {
  const api = useContext(ConsentContext)
  if (!api) throw new Error('useConsentPreferences must be used inside ConsentProvider')
  return api
}
