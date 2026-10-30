'use client'

import type { DomainView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { Globe, PlugConnect } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import SettingsLinkRow from '@/components/settings/settings-link-row'
import SettingsList from '@/components/settings/settings-list'
import { domainsContent as copy } from '@/data/domains'
import { SETTINGS_BACK } from '@/data/settings'
import { usePermissions } from '@/hooks/use-permissions'
import { routes } from '@/lib/routes'
import ChangePrimaryDialog from './change-primary-dialog'
import ConnectDomainDialog from './connect-domain-dialog'
import DomainStatusBadge from './domain-status-badge'

type DomainsSettingsProps = {
  domains: DomainView[]
}

function trafficLabel(d: DomainView): string {
  if (d.isPrimary) return copy.list.isPrimary
  return d.redirectToPrimary ? copy.list.redirects : copy.list.serves
}

/** The quiet line under a domain: what kind it is, what to do next, and how it serves traffic. */
function domainLine(d: DomainView): string {
  return [
    d.kind === 'platform' ? copy.list.platform : null,
    d.kind === 'custom' && d.status === 'pending' ? copy.list.addRecords : null,
    d.isPrimary ? null : trafficLabel(d),
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Settings → Domains: the primary domain, every hostname, and connecting a new one. */
export default function DomainsSettings({ domains }: DomainsSettingsProps) {
  // Hooks
  const { hasPermission } = usePermissions()
  const [connectOpen, setConnectOpen] = useState(false)
  const [primaryOpen, setPrimaryOpen] = useState(false)

  // Render logic
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const primary = domains.find((d) => d.isPrimary) ?? null
  const hasCustom = domains.some((d) => d.kind === 'custom')
  const eligible = domains.filter((d) => d.status === 'active' && d.sslStatus === 'active')

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        actions={
          canManage ? (
            <Button onClick={() => setConnectOpen(true)}>
              <PlugConnect aria-hidden="true" />
              {copy.connect}
            </Button>
          ) : undefined
        }
        back={SETTINGS_BACK}
      />

      <SettingsCard
        title={copy.primary.heading}
        description={copy.primary.body}
        bodyClassName="flex flex-wrap items-center justify-between gap-3"
      >
        {primary ? (
          <Link
            href={routes.settings.domain(primary.id)}
            className="flex min-w-0 items-center gap-2 text-body-strong text-ink-strong hover:underline"
          >
            <Globe className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{primary.hostname}</span>
          </Link>
        ) : (
          <p className="text-body text-muted-foreground">{copy.primary.none}</p>
        )}
        {canManage && eligible.length > 1 ? (
          <Button variant="outline" size="sm" onClick={() => setPrimaryOpen(true)}>
            {copy.primary.change}
          </Button>
        ) : null}
      </SettingsCard>

      <SettingsList
        heading={copy.list.heading}
        after={
          hasCustom ? null : (
            <EmptyState
              heading={copy.empty.heading}
              body={copy.empty.body}
              icon={Globe}
              action={
                canManage ? (
                  <Button variant="outline" onClick={() => setConnectOpen(true)}>
                    {copy.empty.action}
                  </Button>
                ) : undefined
              }
            />
          )
        }
      >
        {domains.map((d) => (
          <li key={d.id}>
            <SettingsLinkRow
              href={routes.settings.domain(d.id)}
              title={
                <>
                  <span className="truncate">{d.hostname}</span>
                  {d.isPrimary ? <StatusChip>{copy.list.isPrimary}</StatusChip> : null}
                </>
              }
              description={
                d.sslStatus === 'failed' && d.error ? (
                  <span className="text-destructive">{d.error}</span>
                ) : (
                  domainLine(d) || undefined
                )
              }
              value={<DomainStatusBadge domain={d} />}
            />
          </li>
        ))}
      </SettingsList>

      <ConnectDomainDialog open={connectOpen} onOpenChange={setConnectOpen} />
      <ChangePrimaryDialog
        open={primaryOpen}
        onOpenChange={setPrimaryOpen}
        domains={eligible}
        currentId={primary?.id ?? null}
      />
    </div>
  )
}
