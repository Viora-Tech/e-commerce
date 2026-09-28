'use client'

import type { EmiOffersConfig } from '@commerce/plugin-emi/offer-for'
import { createContext } from 'react'

/**
 * The EMI & pay later app's settings for this product page, so the line under
 * the price (which ProductView renders with only the selected variant's price)
 * can work out the offer for whichever variant the shopper picks.
 */
export const EmiOffersContext = createContext<EmiOffersConfig | null>(null)
