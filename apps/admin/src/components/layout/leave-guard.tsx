'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import { leaveGuardContent } from '@/data/common'
import { useCopy } from '@/hooks/use-copy'

type LeaveGuardProps = {
  /** The form has changes not saved yet. */
  when: boolean
}

/** A click on an in-admin link that would leave this page; null for anything else. */
function leavingHref(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
    return null
  }
  const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return null
  const url = new URL(a.href, window.location.href)
  if (url.origin !== window.location.origin) return null
  if (url.pathname === window.location.pathname && url.search === window.location.search) {
    return null
  }
  return `${url.pathname}${url.search}${url.hash}`
}

/**
 * Asks before unsaved changes are lost: closing or reloading the tab gets the browser's own
 * warning, and following a link inside the admin (the sidebar, a breadcrumb) asks "Leave without
 * saving?". A title typed on Add product, or keywords ticked from AI suggestions, were dropped
 * without a word (audit #64, #202). Every SaveBar carries one; a form without a save bar (a new
 * record) renders it itself.
 */
export default function LeaveGuard({ when }: LeaveGuardProps) {
  // Hooks
  const copy = useCopy(leaveGuardContent)
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)

  useEffect(() => {
    if (!when) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    const onClick = (e: MouseEvent) => {
      const href = leavingHref(e)
      if (!href) return
      e.preventDefault()
      e.stopPropagation()
      setPending(href)
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
      document.removeEventListener('click', onClick, true)
    }
  }, [when])

  // Event handlers
  const handleLeave = () => {
    const href = pending
    setPending(null)
    if (href) router.push(href)
  }

  return (
    <ConfirmDialog
      open={pending !== null}
      onOpenChange={(open) => !open && setPending(null)}
      title={copy.title}
      body={copy.body}
      confirmLabel={copy.leave}
      cancelLabel={copy.stay}
      tone="destructive"
      onConfirm={handleLeave}
    />
  )
}
