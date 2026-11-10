'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { api } from '@/lib/api-client'

/**
 * Opening Orders › Drafts marks the shoppers' unpaid checkout drafts as seen, so the sidebar's
 * Drafts count goes back to zero. The layout is only read again when there was a count to clear.
 */
export default function MarkDraftsSeen() {
  // Hooks
  const router = useRouter()

  useEffect(() => {
    let live = true
    api.orders
      .markDraftsSeen()
      .then((cleared) => {
        if (live && cleared > 0) router.refresh()
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [router])

  // Render logic
  return null
}
