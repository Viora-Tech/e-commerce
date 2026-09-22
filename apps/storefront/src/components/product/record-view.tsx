'use client'

import { useEffect } from 'react'
import { RECENTLY_VIEWED_COOKIE, withViewed } from '@/lib/recently-viewed'

type RecordViewProps = { handle: string }

const THIRTY_DAYS = 60 * 60 * 24 * 30

/** Current cookie value, read in the browser. */
function readCookie(): string | undefined {
  const prefix = `${RECENTLY_VIEWED_COOKIE}=`
  return document.cookie
    .split('; ')
    .find((c) => c.startsWith(prefix))
    ?.slice(prefix.length)
}

/** Remembers this product for the Recently viewed section on later pages. */
export default function RecordView({ handle }: RecordViewProps) {
  // Hooks
  useEffect(() => {
    const value = encodeURIComponent(withViewed(readCookie(), handle))
    // biome-ignore lint/suspicious/noDocumentCookie: a first-party preference cookie; the Cookie Store API is not in every browser yet.
    document.cookie = `${RECENTLY_VIEWED_COOKIE}=${value}; path=/; max-age=${THIRTY_DAYS}; samesite=lax`
  }, [handle])

  // Render logic
  return null
}
