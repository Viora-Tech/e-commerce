'use client'

import { BarChart3 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { useState } from 'react'
import { toast } from 'sonner'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

/** Brings Shopify's daily sessions and visitors over. Running it again only refreshes them. */
export default function TrafficCard() {
  // Hooks
  const { traffic: copy } = useCopy(shopifyImportContent)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleImport = async () => {
    setBusy(true)
    try {
      const result = await api.shopifyImport.importTraffic()
      if (result.days === 0) toast.info(copy.none)
      else toast.success(copy.done(result.days, result.sessions))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  return (
    <Card>
      <CardContent className="flex h-full flex-col items-start gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted text-ink-strong">
          <BarChart3 className="size-4.5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <h2 className="font-semibold text-ink-strong">{copy.title}</h2>
          <p className="text-body text-muted-foreground">{copy.body}</p>
        </div>
        <Button variant="outline" className="mt-auto" disabled={busy} onClick={handleImport}>
          {busy ? copy.working : copy.action}
        </Button>
      </CardContent>
    </Card>
  )
}
