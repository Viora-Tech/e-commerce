'use client'

import type { DomainView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { ExternalLink } from '@commerce/ui/icons'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@commerce/ui/shadcn/alert-dialog'
import { Button } from '@commerce/ui/shadcn/button'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SettingsCard from '@/components/settings/settings-card'
import { domainsContent } from '@/data/domains'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { formatDateTime } from '@/lib/format-date'
import { routes } from '@/lib/routes'
import DnsRecordsCard from './dns-records-card'
import DomainSslSection from './domain-ssl-section'
import DomainStatusBadge from './domain-status-badge'

const copy = domainsContent.detail
/** How often the page re-checks a domain that is still settling. */
const POLL_MS = 10_000

type DomainDetailProps = {
  initial: DomainView
  primaryHostname: string | null
}

const settling = (d: DomainView) =>
  (d.kind === 'custom' && d.status === 'pending') ||
  (d.status === 'active' && (d.sslStatus === 'pending' || d.sslStatus === 'issuing'))

function connectionText(d: DomainView): string {
  if (d.status === 'active') return copy.verification.connected
  if (d.status === 'failed') return d.error ?? copy.verification.failed
  return copy.verification.pending
}

/** One domain: records to add, connection and SSL state, traffic, primary and removal. */
export default function DomainDetail({ initial, primaryHostname }: DomainDetailProps) {
  // Hooks
  const { hasPermission } = usePermissions()
  const router = useRouter()
  const [domain, setDomain] = useState(initial)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  // Poll while DNS or the certificate is still settling, only while the tab is visible.
  useEffect(() => {
    if (!hasPermission(permissions.SETTINGS_MANAGE) || !settling(domain)) return
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      api.domains
        .verify({ id: domain.id })
        .then(setDomain)
        .catch(() => {})
    }, POLL_MS)
    return () => clearInterval(timer)
  }, [hasPermission, domain])

  // Helpers
  const run = async (fn: () => Promise<void>) => {
    setSaving(true)
    try {
      await fn()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : domainsContent.errors.action)
    } finally {
      setSaving(false)
    }
  }

  // Event handlers
  const handleVerify = async () => {
    setChecking(true)
    try {
      const next = await api.domains.verify({ id: domain.id })
      setDomain(next)
      if (next.status === 'active') toast.success(copy.verification.verified)
      else if (next.status === 'pending') toast.info(copy.verification.stillPending)
      else toast.error(next.error ?? copy.verification.failed)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : domainsContent.errors.action)
    } finally {
      setChecking(false)
    }
  }

  const handleRedirect = (checked: boolean) =>
    run(async () => {
      setDomain(await api.domains.setRedirect({ id: domain.id, redirectToPrimary: checked }))
      toast.success(copy.traffic.saved)
    })

  const handlePrimary = () =>
    run(async () => {
      setDomain(await api.domains.setPrimary({ id: domain.id }))
      toast.success(copy.madePrimary(domain.hostname))
      router.refresh()
    })

  const handleRemove = () =>
    run(async () => {
      setConfirmRemove(false)
      await api.domains.remove({ id: domain.id })
      toast.success(copy.removed(domain.hostname))
      router.push(routes.settings.domains())
      router.refresh()
    })

  // Render logic
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const isCustom = domain.kind === 'custom'
  const canBePrimary = domain.status === 'active' && domain.sslStatus === 'active'
  const lastChecked = domain.lastCheckedAt
    ? copy.verification.checked(formatDateTime(domain.lastCheckedAt))
    : copy.verification.never
  const removeNote = !isCustom ? copy.platformNote : domain.isPrimary ? copy.primaryNote : null
  const visitUrl = domain.status === 'active' ? `https://${domain.hostname}` : null

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={domain.hostname}
        back={{ label: copy.back, href: routes.settings.domains() }}
        actions={
          <>
            <DomainStatusBadge domain={domain} />
            {visitUrl ? (
              <Button
                variant="outline"
                size="sm"
                render={<a href={visitUrl} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink className="size-4" />
                {domain.hostname}
              </Button>
            ) : null}
          </>
        }
      />

      {isCustom ? <DnsRecordsCard records={domain.records} /> : null}

      {isCustom ? (
        <SettingsCard title={copy.verification.heading} bodyClassName="flex flex-col gap-3">
          <p
            className={`text-body ${domain.status === 'failed' ? 'text-destructive' : 'text-foreground'}`}
          >
            {connectionText(domain)}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-caption text-muted-foreground">{lastChecked}</span>
            {canManage ? (
              <Button variant="outline" size="sm" disabled={checking} onClick={handleVerify}>
                {checking ? copy.verification.verifying : copy.verification.verify}
              </Button>
            ) : null}
          </div>
          <div className="border-border border-t pt-3">
            <DomainSslSection domain={domain} canManage={canManage} onChange={setDomain} />
          </div>
        </SettingsCard>
      ) : (
        <SettingsCard>
          <DomainSslSection domain={domain} canManage={canManage} onChange={setDomain} />
        </SettingsCard>
      )}

      <SettingsCard title={copy.traffic.heading} bodyClassName="flex flex-col gap-4">
        {domain.isPrimary ? (
          <p className="text-body text-muted-foreground">{copy.traffic.primaryHelp}</p>
        ) : (
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="domain-redirect">{copy.traffic.redirectLabel}</Label>
              <p className="text-caption text-muted-foreground">
                {copy.traffic.redirectHelp(primaryHostname)}
              </p>
            </div>
            <Switch
              id="domain-redirect"
              checked={domain.redirectToPrimary}
              disabled={!canManage || saving}
              onCheckedChange={handleRedirect}
            />
          </div>
        )}
        {!domain.isPrimary && canManage ? (
          <div className="border-border flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <p className="text-caption text-muted-foreground">
              {canBePrimary ? copy.primaryHelpShort : copy.primaryBlocked}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!canBePrimary || saving}
              onClick={handlePrimary}
            >
              {copy.makePrimary}
            </Button>
          </div>
        ) : null}
      </SettingsCard>

      {canManage ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {removeNote ? <p className="text-caption text-muted-foreground">{removeNote}</p> : null}
          <Button
            variant="destructive"
            disabled={removeNote !== null || saving}
            onClick={() => setConfirmRemove(true)}
          >
            {copy.remove}
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.removeTitle(domain.hostname)}</AlertDialogTitle>
            <AlertDialogDescription>{copy.removeBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{copy.removeCancel}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleRemove}>
              {copy.removeConfirm}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
