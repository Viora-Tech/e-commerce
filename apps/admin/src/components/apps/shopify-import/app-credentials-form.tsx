'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Connection = NonNullable<Awaited<ReturnType<typeof api.shopifyImport.connect>>>

type AppCredentialsFormProps = {
  onConnected: (connection: Connection) => void
}

/** Guides the merchant through making a Dev Dashboard app, then saves its client ID/secret. */
export default function AppCredentialsForm({ onConnected }: AppCredentialsFormProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.connect)
  const [shopDomain, setShopDomain] = useState('')
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [busy, setBusy] = useState(false)

  // Event handlers
  const handleConnect = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const connection = await api.shopifyImport.connect({ shopDomain, clientId, clientSecret })
      setClientSecret('')
      toast.success(copy.connected)
      onConnected(connection)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.connectFailed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const ready =
    shopDomain.trim() !== '' && clientId.trim() !== '' && clientSecret.trim() !== '' && !busy

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{copy.app.stepsHeading}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-body text-muted-foreground">{copy.app.intro}</p>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-body text-muted-foreground">
            {copy.app.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <a
            href={copy.app.docsLink}
            target="_blank"
            rel="noreferrer"
            className="text-body font-medium text-foreground underline underline-offset-2"
          >
            {copy.app.docsLabel}
          </a>
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <form onSubmit={handleConnect} className="flex flex-col gap-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="shopify-app-domain">{copy.domain}</FieldLabel>
                <Input
                  id="shopify-app-domain"
                  size="lg"
                  value={shopDomain}
                  placeholder={copy.domainPlaceholder}
                  onChange={(e) => setShopDomain(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="shopify-client-id">{copy.app.clientId}</FieldLabel>
                <Input
                  id="shopify-client-id"
                  size="lg"
                  value={clientId}
                  placeholder={copy.app.clientIdPlaceholder}
                  onChange={(e) => setClientId(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="shopify-client-secret">{copy.app.clientSecret}</FieldLabel>
                <Input
                  id="shopify-client-secret"
                  size="lg"
                  type="password"
                  value={clientSecret}
                  placeholder={copy.app.clientSecretPlaceholder}
                  onChange={(e) => setClientSecret(e.target.value)}
                  autoComplete="off"
                />
                <FieldDescription>{copy.app.clientSecretHelp}</FieldDescription>
              </Field>
            </FieldGroup>
            <p className="text-caption text-muted-foreground">{copy.app.oauthNote}</p>
            <div className="flex justify-end">
              <Button type="submit" disabled={!ready}>
                {busy ? <Spinner /> : null}
                {copy.app.submit}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
