'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useState } from 'react'
import { toast } from 'sonner'
import { shopifyImportContent } from '@/data/shopify-import'
import { api } from '@/lib/api-client'

type Connection = NonNullable<Awaited<ReturnType<typeof api.shopifyImport.connect>>>

type AppCredentialsFormProps = {
  onConnected: (connection: Connection) => void
}

const copy = shopifyImportContent.connect
const appCopy = copy.app

/** Guides the merchant through making a Dev Dashboard app, then saves its client ID/secret. */
export default function AppCredentialsForm({ onConnected }: AppCredentialsFormProps) {
  // Hooks
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
          <CardTitle>{appCopy.stepsHeading}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-body text-muted-foreground">{appCopy.intro}</p>
          <ol className="flex list-decimal flex-col gap-2 pl-5 text-body text-muted-foreground">
            {appCopy.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <a
            href={appCopy.docsLink}
            target="_blank"
            rel="noreferrer"
            className="text-body font-medium text-foreground underline underline-offset-2"
          >
            {appCopy.docsLabel}
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
                <FieldLabel htmlFor="shopify-client-id">{appCopy.clientId}</FieldLabel>
                <Input
                  id="shopify-client-id"
                  size="lg"
                  value={clientId}
                  placeholder={appCopy.clientIdPlaceholder}
                  onChange={(e) => setClientId(e.target.value)}
                  autoComplete="off"
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="shopify-client-secret">{appCopy.clientSecret}</FieldLabel>
                <Input
                  id="shopify-client-secret"
                  size="lg"
                  type="password"
                  value={clientSecret}
                  placeholder={appCopy.clientSecretPlaceholder}
                  onChange={(e) => setClientSecret(e.target.value)}
                  autoComplete="off"
                />
                <FieldDescription>{appCopy.clientSecretHelp}</FieldDescription>
              </Field>
            </FieldGroup>
            <p className="text-caption text-muted-foreground">{appCopy.oauthNote}</p>
            <div className="flex justify-end">
              <Button type="submit" disabled={!ready}>
                {busy ? <Spinner /> : null}
                {appCopy.submit}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
