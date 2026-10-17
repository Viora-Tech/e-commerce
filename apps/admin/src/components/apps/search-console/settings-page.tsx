'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import SettingsCard from '@/components/settings/settings-card'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import PropertyPicker from './property-picker'

type View = Awaited<ReturnType<typeof api.searchConsole.view>>

type Busy = 'connect' | 'disconnect' | null

const BACK_RESULTS = ['connected', 'cancelled', 'failed'] as const
type BackResult = (typeof BACK_RESULTS)[number]

const isBackResult = (value: string | null): value is BackResult =>
  BACK_RESULTS.some((r) => r === value)

const errorText = (fallback: string, err: unknown) =>
  err instanceof Error && err.message ? err.message : fallback

/**
 * The app's Settings: connect or disconnect the Google account (OAuth through Google's consent
 * screen), pick the Search Console property, and when the numbers were last updated.
 */
export default function SettingsPage() {
  // Hooks
  const copy = useCopy(searchConsoleContent)
  const fmt = useFormat()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [view, setView] = useState<View | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    api.searchConsole.view().then(setView)
  }, [])

  // Back from Google's consent screen: say how it went, then drop the query.
  useEffect(() => {
    const result = params.get('connect')
    if (!isBackResult(result)) return
    const message = copy.settings.connection.back[result]
    if (result === 'connected') toast.success(message)
    else toast.error(message)
    router.replace(pathname)
  }, [params, pathname, router, copy])

  // Event handlers
  const handleConnect = async () => {
    setBusy('connect')
    try {
      const { url } = await api.searchConsole.connectStart()
      window.location.assign(url)
    } catch (err) {
      toast.error(errorText(copy.failed, err))
      setBusy(null)
    }
  }

  const handleDisconnect = async () => {
    setConfirming(false)
    setBusy('disconnect')
    try {
      setView(await api.searchConsole.disconnect())
      toast.success(copy.settings.connection.disconnected)
    } catch (err) {
      toast.error(errorText(copy.failed, err))
    } finally {
      setBusy(null)
    }
  }

  // Early returns
  if (!view) return null

  // Render logic
  const c = copy.settings.connection
  const s = copy.settings.sync
  const status = view.connected
    ? view.email
      ? c.connectedAs(view.email)
      : c.connectedNoEmail
    : c.notConnected

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.settings.title} summary={copy.settings.summary} />
      <SettingsCard title={c.title} description={c.description}>
        <p className="text-body text-foreground">{status}</p>
        {view.reconnect ? (
          <p className="text-body text-destructive">{copy.states.reconnect}</p>
        ) : null}
        {view.available ? (
          <div className="flex flex-wrap gap-2">
            {!view.connected || view.reconnect ? (
              <Button
                loading={busy === 'connect'}
                disabled={busy !== null}
                onClick={() => void handleConnect()}
              >
                {view.connected ? c.reconnect : c.connect}
              </Button>
            ) : null}
            {view.connected ? (
              <Button
                variant="outline"
                loading={busy === 'disconnect'}
                disabled={busy !== null}
                onClick={() => setConfirming(true)}
              >
                {c.disconnect}
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-body text-muted-foreground">{c.unavailable}</p>
        )}
      </SettingsCard>
      <SettingsCard
        title={copy.settings.property.title}
        description={copy.settings.property.description}
      >
        {view.connected ? (
          <PropertyPicker current={view.property} onSaved={setView} />
        ) : (
          <p className="text-body text-muted-foreground">
            {copy.settings.property.needsConnection}
          </p>
        )}
      </SettingsCard>
      <SettingsCard title={s.title} description={s.description}>
        <p className="text-body text-foreground">
          {view.syncedAt ? copy.synced(fmt.when(view.syncedAt)) : s.never}
        </p>
        {view.lastError ? (
          <p className="text-body text-destructive">{s.lastError(view.lastError)}</p>
        ) : null}
      </SettingsCard>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={c.confirm.title}
        body={c.confirm.body}
        confirmLabel={c.confirm.action}
        cancelLabel={c.confirm.cancel}
        tone="default"
        onConfirm={handleDisconnect}
      />
    </div>
  )
}
