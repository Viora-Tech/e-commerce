'use client'

import { PlugConnect } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import SectionPageSkeleton from '@/components/layout/section-page-skeleton'
import SettingsCard from '@/components/settings/settings-card'
import { appsContent } from '@/data/apps'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import PropertyPicker from './property-picker'

type View = Awaited<ReturnType<typeof api.searchConsole.view>>

type Busy = 'connect' | 'disconnect' | null

const BACK_RESULTS = ['connected', 'cancelled', 'failed'] as const
type BackResult = (typeof BACK_RESULTS)[number]

const isBackResult = (value: string | null): value is BackResult =>
  BACK_RESULTS.some((r) => r === value)

/**
 * The app's Settings: connect or disconnect the Google account (OAuth through Google's consent
 * screen), pick the Search Console property, and when the numbers were last updated.
 */
export default function SettingsPage() {
  // Hooks
  const apps = useCopy(appsContent)
  const copy = useCopy(searchConsoleContent)
  const fmt = useFormat()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [view, setView] = useState<View | null>(null)
  const [busy, setBusy] = useState<Busy>(null)
  const [confirming, setConfirming] = useState(false)

  /** The first read failed: Try again instead of a blank page. */
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `loadAttempt` is Try again
  useEffect(() => {
    setLoadFailed(false)
    api.searchConsole.view().then(setView, () => setLoadFailed(true))
  }, [loadAttempt])

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
      toast.error(errorText(err, copy.failed))
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
      toast.error(errorText(err, copy.failed))
    } finally {
      setBusy(null)
    }
  }

  // Early returns
  if (!view && loadFailed) {
    return (
      <LoadFailedState
        size="page"
        heading={apps.couldNotLoad.settings}
        onRetry={() => setLoadAttempt((n) => n + 1)}
      />
    )
  }
  if (!view) return <SectionPageSkeleton cards={2} />

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
                <PlugConnect aria-hidden="true" />
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
