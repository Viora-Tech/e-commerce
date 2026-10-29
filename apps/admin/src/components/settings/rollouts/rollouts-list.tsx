'use client'

import type { RolloutView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { Clock, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import SettingsTable from '@/components/settings/settings-table'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { routes } from '@/lib/routes'
import RolloutRow from './rollout-row'

type RolloutsListProps = {
  /** Every rollout but the archived ones, the newest first. */
  rollouts: RolloutView[]
}

const FILTERS = ['active', 'scheduled', 'draft', 'paused', 'ended'] as const
type Filter = (typeof FILTERS)[number] | null

/**
 * Settings › Markets › Rollouts (Shopify's): every launch and event with what it changes, when
 * it runs and its status, filtered by status.
 */
export default function RolloutsList({ rollouts }: RolloutsListProps) {
  // Hooks
  const copy = useCopy(rolloutsContent)
  const { hasPermission } = usePermissions()
  const [filter, setFilter] = useState<Filter>(null)

  // Render logic
  const canManage = hasPermission(permissions.ROLLOUTS_MANAGE)
  const shown = filter ? rollouts.filter((r) => r.status === filter) : rollouts
  const tabs = [
    { value: null, label: copy.filters.all, count: rollouts.length },
    ...FILTERS.map((f) => ({
      value: f,
      label: copy.filters[f],
      count: rollouts.filter((r) => r.status === f).length,
    })),
  ]
  const createButton = canManage ? (
    <Button nativeButton={false} render={<Link href={routes.settings.newRollout()} />}>
      <Plus aria-hidden="true" />
      {copy.create}
    </Button>
  ) : null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={copy.title}
        subtitle={copy.intro}
        back={{ label: copy.back, href: routes.settings.markets() }}
        actions={createButton}
      />
      {rollouts.length === 0 ? (
        <EmptyState
          variant="page"
          icon={Clock}
          heading={copy.empty.heading}
          body={copy.empty.body}
          action={createButton}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <PillTabs tabs={tabs} value={filter} onChange={setFilter} />
          </div>
          <SettingsTable
            heading={copy.listTitle}
            columns={[
              { label: copy.columns.name },
              { label: copy.columns.changes, className: 'hidden sm:table-cell' },
              { label: copy.columns.when, className: 'hidden md:table-cell' },
              { label: copy.columns.status, center: true },
            ]}
            after={
              shown.length === 0 ? (
                <div className="border-line border-t">
                  <EmptyState variant="plain" body={copy.empty.filtered} />
                </div>
              ) : undefined
            }
          >
            {shown.map((r) => (
              <RolloutRow key={r.id} rollout={r} />
            ))}
          </SettingsTable>
        </div>
      )}
    </div>
  )
}
