'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { whatsappSignupContent } from '@/data/whatsapp-signup'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { runEmbeddedSignup } from '@/lib/facebook-sdk'

type Loaded = Awaited<ReturnType<typeof api.platformApps.whatsapp>>

type Busy = 'idle' | 'popup' | 'popup-app' | 'saving' | 'disconnecting'

const STATUS_TONE: Record<string, 'secondary' | 'destructive'> = {
  restricted: 'destructive',
  disabled: 'destructive',
  disconnected: 'destructive',
}

/**
 * Apps → WhatsApp: "Connect with Facebook" (WhatsApp Embedded Signup) when this deployment
 * has the Meta app's signup configuration, and the connected account's health from Meta's
 * webhooks (restricted, quality, failed sends). Nothing shows when neither applies.
 */
export default function WhatsappSignupCard() {
  // Hooks
  const copy = useCopy(whatsappSignupContent)
  const fmt = useFormat()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [busy, setBusy] = useState<Busy>('idle')

  useEffect(() => {
    api.platformApps
      .whatsapp()
      .then(setLoaded)
      .catch(() => setLoaded(null))
  }, [])

  // Event handlers
  const handleConnect = async (businessApp: boolean) => {
    if (!loaded?.signup) return
    setBusy(businessApp ? 'popup-app' : 'popup')
    try {
      const r = await runEmbeddedSignup({ ...loaded.signup, businessApp })
      if (r.kind === 'cancelled') {
        toast(copy.cancelled)
        return
      }
      if (r.kind === 'error') {
        toast.error(r.message ?? copy.failed)
        return
      }
      setBusy('saving')
      await api.platformApps.completeWhatsapp({
        code: r.code,
        wabaId: r.wabaId,
        phoneNumberId: r.phoneNumberId,
      })
      toast.success(copy.connected)
      // The channel settings below were filled in on the server; load them fresh.
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error && err.message !== 'sdk' ? err.message : copy.blocked)
    } finally {
      setBusy('idle')
    }
  }

  const handleDisconnect = async () => {
    setBusy('disconnecting')
    try {
      await api.platformApps.disconnectWhatsapp()
      toast.success(copy.disconnected)
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
      setBusy('idle')
    }
  }

  // Early returns
  if (!loaded || (!loaded.signup && !loaded.account)) return null

  // Render logic
  const account = loaded.account
  const detail = account?.detail ?? {}
  const status = account?.status ?? 'active'
  const rows = account
    ? [
        [copy.number, detail.displayPhone || detail.phoneNumberId],
        [copy.name, detail.verifiedName],
        [copy.quality, detail.quality],
        [copy.lastFailure, detail.lastFailure],
        [copy.lastTemplate, detail.lastTemplate],
        [copy.connectedOn, fmt.date(account.connectedAt)],
      ].filter((row): row is [string, string] => Boolean(row[1]))
    : []

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-body font-medium text-foreground">
            {account ? copy.account : copy.title}
          </p>
          {account ? null : <p className="text-caption text-muted-foreground">{copy.intro}</p>}
        </div>
        {account ? (
          <Badge variant={STATUS_TONE[status] ?? 'secondary'}>
            {copy.status[status] ?? status}
          </Badge>
        ) : null}
      </div>
      {rows.length ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-caption">
          {rows.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {account && status !== 'active' ? (
        <p className="text-caption text-destructive">{copy.statusHelp}</p>
      ) : null}
      {account && detail.registered === 'no' ? (
        <p className="text-caption text-muted-foreground">{copy.notRegistered}</p>
      ) : null}
      {account ? <p className="text-caption text-muted-foreground">{copy.billing}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        {loaded.signup ? (
          <Button type="button" onClick={() => handleConnect(false)} disabled={busy !== 'idle'}>
            {busy === 'popup' || busy === 'saving' ? <Spinner /> : null}
            {busy === 'popup' ? copy.connecting : busy === 'saving' ? copy.saving : copy.connect}
          </Button>
        ) : null}
        {loaded.signup && !account ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => handleConnect(true)}
            disabled={busy !== 'idle'}
          >
            {busy === 'popup-app' ? <Spinner /> : null}
            {busy === 'popup-app' ? copy.connecting : copy.connectApp}
          </Button>
        ) : null}
        {account ? (
          <Button
            type="button"
            variant="ghost"
            onClick={handleDisconnect}
            disabled={busy !== 'idle'}
          >
            {busy === 'disconnecting' ? <Spinner /> : null}
            {copy.disconnect}
          </Button>
        ) : null}
      </div>
      {loaded.signup && !account ? (
        <>
          <p className="text-caption text-muted-foreground">{copy.appHelp}</p>
          <p className="text-caption text-muted-foreground">{copy.manual}</p>
        </>
      ) : null}
    </div>
  )
}
