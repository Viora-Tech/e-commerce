'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { shopifyAppInstallContent } from '@/data/shopify-app-install'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

/**
 * "Install the Koomerce app": the merchant types their shop, Shopify asks them to approve the
 * platform app's read scopes, and the callback brings them back connected.
 */
export default function AppInstallForm() {
  // Hooks
  const copy = useCopy(shopifyImportContent.connect)
  const install = useCopy(shopifyAppInstallContent)
  const [shopDomain, setShopDomain] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleInstall = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const { url } = await api.shopifyImport.startAppInstall({ shopDomain })
      window.location.assign(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : install.failed)
      setBusy(false)
    }
  }

  // Render logic
  const ready = shopDomain.trim() !== '' && !busy

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <DataCard title={install.stepsHeading} bodyClassName="flex flex-col gap-4">
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-body text-foreground">
          {install.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="text-caption text-muted-foreground">{install.note}</p>
      </DataCard>
      <DataCard title={install.formHeading}>
        <form onSubmit={handleInstall} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="shopify-install-domain">{copy.domain}</FieldLabel>
              <Input
                id="shopify-install-domain"
                size="lg"
                value={shopDomain}
                placeholder={copy.domainPlaceholder}
                onChange={(e) => setShopDomain(e.target.value)}
                autoComplete="off"
              />
            </Field>
          </FieldGroup>
          <div className="flex justify-end">
            <Button type="submit" disabled={!ready}>
              {busy ? <Spinner /> : null}
              {busy ? install.redirecting : install.submit}
            </Button>
          </div>
        </form>
      </DataCard>
    </div>
  )
}
