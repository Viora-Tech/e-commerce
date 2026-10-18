'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Connection = NonNullable<Awaited<ReturnType<typeof api.shopifyImport.connect>>>

type LegacyTokenFormProps = {
  onConnected: (connection: Connection) => void
}

/** The steps to make a custom-app token, and the form that checks and saves it. */
export default function LegacyTokenForm({ onConnected }: LegacyTokenFormProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.connect)
  const [shopDomain, setShopDomain] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const connection = await api.shopifyImport.connect({ shopDomain, accessToken })
      setAccessToken('')
      toast.success(copy.connected)
      onConnected(connection)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.connectFailed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const ready = shopDomain.trim() !== '' && accessToken.trim() !== '' && !busy

  return (
    <div className="flex flex-col gap-4">
      <DataCard title={copy.token.stepsHeading}>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-body text-muted-foreground">
          {copy.token.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </DataCard>
      <Card>
        <CardContent>
          <form onSubmit={handleConnect} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="shopify-domain">{copy.token.domain}</FieldLabel>
                <Input
                  id="shopify-domain"
                  size="lg"
                  value={shopDomain}
                  placeholder={copy.token.domainPlaceholder}
                  onChange={(e) => setShopDomain(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="shopify-token">{copy.token.token}</FieldLabel>
                <Input
                  id="shopify-token"
                  size="lg"
                  type="password"
                  value={accessToken}
                  placeholder={copy.token.tokenPlaceholder}
                  onChange={(e) => setAccessToken(e.target.value)}
                  autoComplete="off"
                />
                <FieldDescription>{copy.token.tokenHelp}</FieldDescription>
              </Field>
            </FieldGroup>
            <div className="flex justify-end">
              <Button type="submit" disabled={!ready}>
                {busy ? <Spinner /> : null}
                {copy.token.submit}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
