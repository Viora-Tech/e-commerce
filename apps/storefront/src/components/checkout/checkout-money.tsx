'use client'

import { MoneyFormatContext } from '@commerce/blocks'
import type { ReactNode } from 'react'

type CheckoutMoneyProps = { children: ReactNode }

/**
 * One way of writing rupees across the checkout. The store's format ("Rs. 13,499.00") suits its
 * pages, but the checkout's own lines (Pay, shipping, EMI) use the rupee sign, so the summary
 * follows them. A market abroad still shows its own currency.
 */
export default function CheckoutMoney({ children }: CheckoutMoneyProps) {
  return <MoneyFormatContext value={null}>{children}</MoneyFormatContext>
}
