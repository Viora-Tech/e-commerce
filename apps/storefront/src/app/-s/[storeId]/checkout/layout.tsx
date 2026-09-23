import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { NO_INDEX } from '@/lib/seo'

type CheckoutLayoutProps = { children: ReactNode }

/** Checkout, payment and thank-you pages are one shopper's order: never indexed. */
export const metadata: Metadata = { robots: NO_INDEX }

export default function CheckoutLayout({ children }: CheckoutLayoutProps) {
  return children
}
