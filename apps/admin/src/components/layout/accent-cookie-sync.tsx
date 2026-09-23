'use client'

import { useEffect } from 'react'
import { writeAccentCookie } from '@/lib/accent-cookie'

type AccentCookieSyncProps = {
  organizationId: string
  accent: string | null
}

/** Writes the accent the layout just read from the database into the first-paint cookie. */
export default function AccentCookieSync({ organizationId, accent }: AccentCookieSyncProps) {
  // Hooks
  useEffect(() => {
    writeAccentCookie(organizationId, accent)
  }, [organizationId, accent])

  return null
}
