'use client'

import type { ReactNode } from 'react'
import { MoneyFormatContext } from '../money-format'

type MoneyFormatProviderProps = {
  /** The store's price format (`Rs. {{amount}}`); null keeps the currency's own. */
  format: string | null
  children: ReactNode
}

/** Wraps the storefront so every price block reads the store's price format. */
export default function MoneyFormatProvider({ format, children }: MoneyFormatProviderProps) {
  return <MoneyFormatContext value={format}>{children}</MoneyFormatContext>
}
