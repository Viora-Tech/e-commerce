'use client'

import type { DomainView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { ExternalLink, RefreshCw, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Label } from '@commerce/ui/shadcn/label'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SettingsCard from '@/components/settings/settings-card'
import { domainEdgeContent, domainsContent } from '@/data/domains'
import { useCopy } from '@/hooks/use-copy'
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

/** A live row Cloudflare has not confirmed: it still answers, but it is not connected yet. */
const edgeUnconfirmed = (d: DomainView) =>
  d.status === 'active' && d.edgeRecords !== null && d.sslStatus !== 'active'

function connectionText(d: DomainView, edge: typeof domainEdgeContent): string {
  if (d.heldElsewhere) return edge.held
  if (edgeUnconfirmed(d)) return d.error ?? edge.settling
  if (d.status === 'active') return copy.verification.connected
  if (d.status === 'failed') return d.error ?? copy.verification.failed
  return copy.verification.pending
}

/** One domain: records to add, connection and SSL state, traffic, primary and removal. */
export default function DomainDetail({ initial, primaryHostname }: DomainDetailProps) {
  // Hooks
  const { hasPermission } = usePermissions()
  const edge = useCopy(domainEdgeContent)
  const router = useRouter()
  const [domain, setDomain] = useState(initial)
  const [checking, setChecking] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  /** The redirect switch as edited; the save bar records it. */
  const [redirect, setRedirect] = useState(initial.redirectToPrimary)

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
      if (next.heldElsewhere) toast.error(edge.held)
      else if (edgeUnconfirmed(next)) toast.info(connectionText(next, edge))
      else if (next.status === 'active') toast.success(copy.verification.verified)
      else if (next.status === 'pending') toast.info(copy.verification.stillPending)
      else toast.error(next.error ?? copy.verification.failed)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : domainsContent.errors.action)
    } finally {
      setChecking(false)
    }
  }

  const handleSaveRedirect = () =>
    run(async () => {
      const next = await api.domains.setRedirect({ id: domain.id, redirectToPrimary: redirect })
      setDomain(next)
      setRedirect(next.redirectToPrimary)
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
      <SaveBar
        open={redirect !== domain.redirectToPrimary}
        message={copy.traffic.unsaved}
        saveLabel={copy.traffic.save}
        discardLabel={copy.traffic.discard}
        onSave={handleSaveRedirect}
        onDiscard={() => setRedirect(domain.redirectToPrimary)}
        saving={saving}
      />
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
                nativeButton={false}
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
            className={`text-body ${domain.status === 'failed' || domain.heldElsewhere ? 'text-destructive' : 'text-foreground'}`}
          >
            {connectionText(domain, edge)}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-caption text-muted-foreground">{lastChecked}</span>
            {canManage ? (
              <Button variant="outline" size="sm" disabled={checking} onClick={handleVerify}>
                <RefreshCw aria-hidden="true" />
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
        ) : domain.redirectOnly ? (
          <p className="text-body text-muted-foreground">
            {edge.apexRedirects(`www.${domain.hostname}`)}
          </p>
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
              checked={redirect}
              disabled={!canManage || saving}
              onCheckedChange={setRedirect}
            />
          </div>
        )}
        {!domain.isPrimary && !domain.redirectOnly && canManage ? (
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
            <Trash2 aria-hidden="true" />
            {copy.remove}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        tone="destructive"
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={copy.removeTitle(domain.hostname)}
        body={copy.removeBody}
        confirmLabel={copy.removeConfirm}
        cancelLabel={copy.removeCancel}
        onConfirm={handleRemove}
      />
    </div>
  )
}
