'use client'

import type { DomainView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { Globe } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import SettingsPageHeader from '@/components/settings/settings-page-header'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import RowActionsCell from '@/components/table/row-actions-cell'
import { domainsContent as copy } from '@/data/domains'
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
      <SettingsPageHeader
        title={copy.title}
        subtitle={copy.intro}
        actions={
          canManage ? (
            <Button onClick={() => setConnectOpen(true)}>{copy.connect}</Button>
          ) : undefined
        }
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

      <SettingsTable
        heading={copy.list.heading}
        actions
        total={domains.length}
        columns={[
          { label: copy.list.columns.domain },
          { label: copy.list.columns.status, center: true },
          { label: copy.list.columns.traffic, className: 'hidden sm:table-cell' },
        ]}
        after={
          hasCustom ? null : (
            <div className="border-line border-t">
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
            </div>
          )
        }
      >
        {domains.map((d) => (
          <SettingsTableRow key={d.id}>
            <SettingsTableCell>
              <div className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 font-semibold text-ink-strong">
                  <span className="truncate">{d.hostname}</span>
                  {d.isPrimary ? <StatusChip>{copy.list.isPrimary}</StatusChip> : null}
                </span>
                {d.kind === 'platform' ? (
                  <span className="text-caption text-muted-foreground">{copy.list.platform}</span>
                ) : null}
                {d.sslStatus === 'failed' && d.error ? (
                  <span className="text-caption text-destructive">{d.error}</span>
                ) : null}
              </div>
            </SettingsTableCell>
            <SettingsTableCell center>
              <DomainStatusBadge domain={d} />
            </SettingsTableCell>
            <SettingsTableCell className="hidden text-muted-foreground sm:table-cell">
              {trafficLabel(d)}
            </SettingsTableCell>
            <SettingsTableCell className="w-16 p-0 last:pr-2 md:last:pr-2">
              <RowActionsCell href={routes.settings.domain(d.id)} />
            </SettingsTableCell>
          </SettingsTableRow>
        ))}
      </SettingsTable>

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
