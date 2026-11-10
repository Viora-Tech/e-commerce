'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { api } from '@/lib/api-client'

type MarkDraftSeenProps = { id: string }

/**
 * Opening a shopper's checkout draft marks it seen, so the sidebar's Drafts count drops by one
 * (owner, 10 Nov 2026). The layout is only read again when the count went down.
 */
export default function MarkDraftSeen({ id }: MarkDraftSeenProps) {
  // Hooks
  const router = useRouter()

  useEffect(() => {
    let live = true
    api.orders
      .markDraftSeen({ id })
      .then((dropped) => {
        if (live && dropped) router.refresh()
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [id, router])

  // Render logic
  return null
}
