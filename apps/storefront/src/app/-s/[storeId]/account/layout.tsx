import type { Metadata } from 'next'
import type { ReactNode } from 'react'

type AccountLayoutProps = { children: ReactNode }

/** Account pages are private to one shopper: never indexed, never followed. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * No chrome of its own: the signed-in pages and the sign-in page render through their theme
 * templates (`account`, `login`), whose main section draws the page frame (`AccountFrame`); the
 * other account pages draw it themselves.
 */
export default function AccountLayout({ children }: AccountLayoutProps) {
  // Render logic
  return children
}
