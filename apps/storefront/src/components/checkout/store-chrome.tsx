'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { isCheckoutPath } from '@/lib/checkout-path'

type StoreChromeProps = { children: ReactNode }

/**
 * The theme's header, footer and cursor effect around every page except the checkout. They
 * stay mounted there, only hidden, so the consent banner and the tracking tags it gates
 * (drawn by the footer group) keep running into the thank-you page. `display: contents`
 * elsewhere, so a sticky header still sticks to the page.
 */
export default function StoreChrome({ children }: StoreChromeProps) {
  // Hooks
  const pathname = usePathname()

  // Render logic
  const hidden = isCheckoutPath(pathname)

  return (
    <div className={hidden ? 'hidden' : 'contents'} hidden={hidden}>
      {children}
    </div>
  )
}
