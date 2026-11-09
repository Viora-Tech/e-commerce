'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { ADMIN_REFRESH_EVENT, noteRefreshed, shouldRefresh } from '@/lib/focus-refresh'

/**
 * Reads the page again when the merchant comes back to the tab or the window after 30 s or more
 * (#1410): new orders show without a reload. A server-component refresh keeps client state. It
 * waits while offline, while a dialog is open or a form is unsaved, and skips pages that poll on
 * their own. Focus moving into an iframe (a preview) and back is not "coming back". Renders
 * nothing.
 */
export default function RefreshOnFocus() {
  // Hooks
  const router = useRouter()
  const pathname = usePathname()

  // A navigation reads the new page: that counts as fresh.
  useEffect(() => {
    if (pathname) noteRefreshed()
  }, [pathname])

  useEffect(() => {
    // The window lost focus to another app or tab, not to an iframe inside the page.
    let away = false
    const refresh = () => {
      const due = shouldRefresh({
        now: Date.now(),
        pathname: window.location.pathname,
        online: navigator.onLine,
        dialogOpen: document.querySelector('[role="dialog"], [role="alertdialog"]') !== null,
      })
      if (!due) return
      noteRefreshed()
      router.refresh()
      window.dispatchEvent(new Event(ADMIN_REFRESH_EVENT))
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    // The focused element is only known once the blur has finished.
    const onBlur = () =>
      window.setTimeout(() => {
        away = !(document.activeElement instanceof HTMLIFrameElement)
      }, 0)
    const onFocus = () => {
      if (!away) return
      away = false
      refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('blur', onBlur)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
    }
  }, [router])

  return null
}
