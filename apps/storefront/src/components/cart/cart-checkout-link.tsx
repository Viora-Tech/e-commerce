'use client'

import type { MouseEvent, ReactNode } from 'react'

type CartCheckoutLinkProps = {
  className: string
  children: ReactNode
}

/**
 * The cart's Checkout button. A discount code typed in the cart but never applied goes along
 * (`/checkout/start?discount=`), so the shopper does not reach checkout without it.
 */
export default function CartCheckoutLink({ className, children }: CartCheckoutLinkProps) {
  // Event handlers
  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    const code = document
      .querySelector<HTMLInputElement>('[data-pending-code="discount"]')
      ?.value.trim()
    if (!code) return
    e.preventDefault()
    window.location.assign(`/checkout/start?discount=${encodeURIComponent(code)}`)
  }

  // Render logic
  return (
    <a href="/checkout/start" className={className} onClick={handleClick}>
      {children}
    </a>
  )
}
