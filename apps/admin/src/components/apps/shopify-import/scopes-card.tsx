'use client'

import type { ScopeHandle } from '@commerce/plugin-shopify-import/client'
import { RefreshCw } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import StatusChip from '@/components/layout/status-chip'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Check = Awaited<ReturnType<typeof api.shopifyImport.testConnection>>

/** Runs a real Shopify call and shows the shop name plus which import scopes the token has. */
export default function ScopesCard() {
  // Hooks
  const copy = useCopy(shopifyImportContent.connect)
  const [check, setCheck] = useState<Check | null>(null)
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleTest = async () => {
    setBusy(true)
    try {
      setCheck(await api.shopifyImport.testConnection())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.testFailed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const scopeLabel = (handle: ScopeHandle) => copy.scopeNames[handle]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{copy.testHeading}</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={handleTest} disabled={busy}>
          {busy ? <Spinner /> : <RefreshCw aria-hidden="true" />}
          {copy.test}
        </Button>
      </CardHeader>
      {check ? (
        <CardContent className="flex flex-col gap-3">
          <p className="text-body text-ink-strong">
            {copy.shop}: {check.shopName}
          </p>
          {check.missing.length === 0 ? (
            <p className="text-body text-muted-foreground">{copy.scopesAllGranted}</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-caption text-muted-foreground">{copy.scopesMissing}</span>
              <div className="flex flex-wrap gap-1.5">
                {check.missing.map((handle) => (
                  <StatusChip key={handle} tone="danger">
                    {scopeLabel(handle)}
                  </StatusChip>
                ))}
              </div>
            </div>
          )}
          {check.granted.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              <span className="text-caption text-muted-foreground">{copy.scopesGranted}</span>
              <div className="flex flex-wrap gap-1.5">
                {check.granted.map((handle) => (
                  <Badge key={handle} variant="secondary">
                    {scopeLabel(handle)}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  )
}
