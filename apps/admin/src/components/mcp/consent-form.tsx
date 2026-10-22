'use client'

import type { AuthorizeParams } from '@commerce/api'
import { type ApiScopes, mcpClientOf } from '@commerce/core/api-access'
import { CheckIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { useState } from 'react'
import { decideConsent } from '@/app/oauth/authorize/actions'
import { mcpContent } from '@/data/mcp'
import { useCopy } from '@/hooks/use-copy'
import McpClientLogo from './mcp-client-logo'
import ScopePicker from './scope-picker'

type ConsentFormProps = {
  params: AuthorizeParams
  client: string
  store: { name: string; slug: string }
  email: string
  member: string
  initialScopes: ApiScopes
}

/** "Allow Claude to use Waimers?": the areas it may use, then Allow or Deny. */
export default function ConsentForm({
  params,
  client,
  store,
  email,
  member,
  initialScopes,
}: ConsentFormProps) {
  // Hooks
  const copy = useCopy(mcpContent)
  const [scopes, setScopes] = useState<ApiScopes>(initialScopes)
  const [busy, setBusy] = useState<'allow' | 'deny' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleDecide = async (allow: boolean) => {
    if (allow && !Object.keys(scopes).length) return setError(copy.consent.pickArea)
    setBusy(allow ? 'allow' : 'deny')
    setError(null)
    const r = await decideConsent({ params, slug: store.slug, scopes, allow })
    if (!r.ok) {
      setBusy(null)
      return setError(copy.consent.failed)
    }
    // The client's own address: https, a local port, or an app scheme like cursor://.
    window.location.assign(r.redirect)
  }

  // Render logic
  return (
    <main className="flex min-h-svh items-start justify-center px-4 pt-[10vh] pb-10">
      <Card className="flex w-full max-w-lg flex-col gap-5 p-6">
        <div className="flex items-center gap-3">
          <McpClientLogo client={mcpClientOf(client)} size="lg" />
          <div className="flex flex-col gap-0.5">
            <h1 className="text-section-title text-ink-strong">
              {copy.consent.title(client, store.name)}
            </h1>
            <p className="text-caption text-muted-foreground">{copy.consent.signedInAs(email)}</p>
          </div>
        </div>
        <p className="text-body text-muted-foreground">{copy.consent.intro(client, member)}</p>
        <div className="flex flex-col gap-1.5">
          <span className="text-body font-medium">{copy.consent.canAccess(client)}</span>
          <ScopePicker value={scopes} onChange={setScopes} idPrefix="consent" />
        </div>
        <p className="text-caption text-muted-foreground">{copy.consent.approvalNote}</p>
        {error ? <p className="text-caption text-destructive">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => handleDecide(false)}
            disabled={busy !== null}
            loading={busy === 'deny'}
          >
            {copy.consent.deny}
          </Button>
          <Button
            onClick={() => handleDecide(true)}
            disabled={busy !== null}
            loading={busy === 'allow'}
          >
            <CheckIcon aria-hidden="true" />
            {busy === 'allow' ? copy.consent.returning(client) : copy.consent.allow}
          </Button>
        </div>
      </Card>
    </main>
  )
}
