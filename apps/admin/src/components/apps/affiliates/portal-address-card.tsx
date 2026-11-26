'use client'

import { permissions } from '@commerce/core/permissions'
import { Globe, PlugConnect } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DnsRecordsCard from '@/components/domains/dns-records-card'
import CopyButton from '@/components/fields/copy-button'
import EmptyState from '@/components/layout/empty-state'
import SettingsCard from '@/components/settings/settings-card'
import { affiliatePortalDomainContent } from '@/data/affiliate-portal-domain'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'
import PortalAddressStatus, { portalPhase } from './portal-address-status'

type PortalState = Awaited<ReturnType<typeof api.affiliates.portalDomain.get>>

/** How often a pending portal host is checked again, as on the domain's own page. */
const POLL_MS = 10_000

/**
 * Settings › Portal address: where affiliates sign in now, and connecting `affiliate.<primary
 * domain>` through the same domain flow as Settings › Domains (records, Verify, status, remove).
 */
export default function PortalAddressCard() {
  // Hooks
  const copy = useCopy(affiliatePortalDomainContent)
  const { hasPermission } = usePermissions()
  const [state, setState] = useState<PortalState | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)

  const canRead =
    hasPermission(permissions.MARKETING_READ) && hasPermission(permissions.SETTINGS_READ)
  const canManage =
    hasPermission(permissions.MARKETING_WRITE) && hasPermission(permissions.SETTINGS_MANAGE)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `loadAttempt` is Try again
  useEffect(() => {
    if (!canRead) return
    setLoadFailed(false)
    api.affiliates.portalDomain.get().then(setState, () => setLoadFailed(true))
  }, [canRead, loadAttempt])

  // Check a pending host again while the tab is visible, until it is live or failed.
  const settling = state?.domain ? ['pending', 'certificate'].includes(portalPhase(state.domain)) : false
  useEffect(() => {
    if (!canManage || !settling) return
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      api.affiliates.portalDomain
        .verify()
        .then(setState)
        .catch(() => {})
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [canManage, settling])

  // Event handlers
  const handleConnect = async () => {
    setBusy(true)
    try {
      const next = await api.affiliates.portalDomain.connect()
      setState(next)
      if (next.domain) toast.success(copy.connected(next.domain.hostname))
    } catch (err) {
      toast.error(errorText(err, copy.actionFailed))
    } finally {
      setBusy(false)
    }
  }
  const handleVerify = async () => {
    setChecking(true)
    try {
      const next = await api.affiliates.portalDomain.verify()
      setState(next)
      const phase = next.domain ? portalPhase(next.domain) : null
      if (phase === 'live') toast.success(copy.verified)
      else if (phase === 'failed') toast.error(next.domain?.error ?? copy.failed)
      else toast.info(copy.stillPending)
    } catch (err) {
      toast.error(errorText(err, copy.actionFailed))
    } finally {
      setChecking(false)
    }
  }
  const handleDisconnect = async () => {
    const hostname = state?.domain?.hostname
    setBusy(true)
    try {
      setState(await api.affiliates.portalDomain.remove())
      if (hostname) toast.success(copy.disconnected(hostname))
    } catch (err) {
      toast.error(errorText(err, copy.actionFailed))
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  if (!canRead) {
    return (
      <SettingsCard title={copy.title} description={copy.description}>
        <p className="text-body text-muted-foreground">{copy.noAccess}</p>
      </SettingsCard>
    )
  }
  if (!state) {
    return (
      <SettingsCard title={copy.title} description={copy.description}>
        {loadFailed ? (
          <LoadFailedState heading={copy.loadFailed} onRetry={() => setLoadAttempt((n) => n + 1)} />
        ) : (
          <Skeleton className="h-5 w-64" />
        )}
      </SettingsCard>
    )
  }

  // Render logic
  const { domain, hostname, fallbackUrl } = state
  const live = domain !== null && portalPhase(domain) === 'live'
  const liveUrl = live && domain ? `https://${domain.hostname}` : null
  const currentUrl = liveUrl ?? fallbackUrl

  return (
    <>
      <SettingsCard title={copy.title} description={copy.description}>
        {currentUrl ? (
          <div className="flex flex-col gap-1">
            <span className="text-caption text-muted-foreground">{copy.current}</span>
            <span className="flex min-w-0 items-center gap-1">
              <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate font-mono text-body-strong">{currentUrl}</span>
              <CopyButton value={currentUrl} what={copy.copyWhat} visible />
            </span>
            <span className="text-caption text-muted-foreground">
              {liveUrl ? copy.live(liveUrl) : copy.fallbackNote}
            </span>
          </div>
        ) : null}
        {!hostname ? (
          <EmptyState
            variant="inline"
            icon={Globe}
            heading={copy.noDomain.heading}
            body={copy.noDomain.body}
            action={
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href={routes.settings.domains()} />}
              >
                {copy.noDomain.action}
              </Button>
            }
          />
        ) : domain ? (
          <PortalAddressStatus
            domain={domain}
            canManage={canManage}
            checking={checking}
            busy={busy}
            onVerify={handleVerify}
            onDisconnect={handleDisconnect}
          />
        ) : (
          <div className="flex flex-col gap-3 border-border border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-body text-muted-foreground">{copy.useHelp(hostname)}</p>
            {canManage ? (
              <Button className="shrink-0" loading={busy} disabled={busy} onClick={handleConnect}>
                <PlugConnect aria-hidden="true" />
                {copy.use(hostname)}
              </Button>
            ) : (
              <p className="text-caption text-muted-foreground">{copy.noAccess}</p>
            )}
          </div>
        )}
      </SettingsCard>
      {domain && !live ? <DnsRecordsCard records={domain.records} /> : null}
    </>
  )
}
