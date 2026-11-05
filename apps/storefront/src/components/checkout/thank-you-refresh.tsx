'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

/** How often the page re-reads the order while a payment is being confirmed. */
const POLL_MS = 5_000

/** Keeps the page current while it waits on the gateway; draws nothing. */
export default function ThankYouRefresh() {
  // Hooks
  const router = useRouter()

  useEffect(() => {
    const poll = setInterval(() => router.refresh(), POLL_MS)
    return () => clearInterval(poll)
  }, [router])

  // Render logic
  return null
}
