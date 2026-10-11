'use client'

import { Store } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

const connectHref = `${shopifyImportContent.base}/connect`

/**
 * App header button, on every tab: a primary "Connect Shopify store" while nothing is
 * connected, then a secondary one that shows the connected domain and opens the connection.
 */
export default function ConnectHeaderButton() {
  // Hooks
  const copy = useCopy(shopifyImportContent.connect)
  const pathname = usePathname()
  const [domain, setDomain] = useState<string | null | undefined>(undefined)

  // Re-read on every navigation, so connecting or disconnecting updates it at once.
  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is the trigger
  useEffect(() => {
    api.shopifyImport
      .connection()
      .then((c) => setDomain(c?.shopDomain ?? null))
      .catch(() => setDomain(null))
  }, [pathname])

  // Early returns
  if (domain === undefined) return null

  return domain === null ? (
    <Button nativeButton={false} render={<Link href={connectHref} />}>
      <Store aria-hidden="true" />
      {copy.headerConnect}
    </Button>
  ) : (
    <Button variant="outline" nativeButton={false} render={<Link href={connectHref} />}>
      <Store aria-hidden="true" />
      <span className="max-w-48 truncate">{domain}</span>
      <span className="text-muted-foreground">{copy.headerEdit}</span>
    </Button>
  )
}
