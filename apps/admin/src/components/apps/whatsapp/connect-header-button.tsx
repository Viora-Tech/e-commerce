'use client'

import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { whatsappAppContent } from '@/data/whatsapp-app'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

/**
 * The app bar's "Connect WhatsApp" (Figma 928:11811), on every WhatsApp page while the store's
 * WhatsApp is not connected; it opens Settings, where Embedded Signup and the fields live.
 */
export default function WhatsappConnectHeaderButton() {
  // Hooks
  const copy = useCopy(whatsappAppContent)
  const pathname = usePathname()
  const [connected, setConnected] = useState<boolean | undefined>(undefined)

  // Re-read on every navigation, so connecting updates it at once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
  useEffect(() => {
    api.platformApps
      .whatsappSetup()
      .then((r) => setConnected(r.connected))
      .catch(() => setConnected(undefined))
  }, [pathname])

  // Early returns
  if (connected !== false) return null

  return (
    <Button
      variant="outline"
      nativeButton={false}
      render={<Link href={routes.apps.page('whatsapp', 'settings')} />}
    >
      {copy.connectAction}
    </Button>
  )
}
