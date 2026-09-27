'use client'

import type { EmiOffersConfig } from '@commerce/plugin-emi/offer'
import type { ReactNode } from 'react'
import { EmiOffersContext } from '@/lib/emi-offers-context'

type EmiOffersProviderProps = {
  config: EmiOffersConfig
  children: ReactNode
}

/** Hands the server-resolved EMI settings to `EmiOffers` inside the buy box. */
export default function EmiOffersProvider({ config, children }: EmiOffersProviderProps) {
  return <EmiOffersContext value={config}>{children}</EmiOffersContext>
}
