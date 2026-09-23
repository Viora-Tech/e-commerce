import type { Metadata } from 'next'
import type { ReactNode } from 'react'

type AccountLayoutProps = { children: ReactNode }

/** Account pages are private to one shopper: never indexed, never followed. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AccountLayout({ children }: AccountLayoutProps) {
  // Render logic
  return <div className="page-width py-10 md:py-14">{children}</div>
}
