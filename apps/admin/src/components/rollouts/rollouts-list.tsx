'use client'

import type { RolloutView } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { Clock, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import PillTabs from '@/components/layout/pill-tabs'
import ProoflyListPage from '@/components/layout/proofly-list-page'
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
 * Rollouts, as Shopify's list: status tabs over one table with each launch or event's status,
 * type, start, end, audience and changes.
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
    <Button nativeButton={false} render={<Link href={routes.rollouts.new()} />}>
      <Plus aria-hidden="true" />
      {copy.create}
    </Button>
  ) : null

  return (
    <ProoflyListPage title={copy.title} summary={copy.intro} actions={createButton}>
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
            columns={[
              { label: copy.columns.name },
              { label: copy.columns.status },
              { label: copy.columns.type, className: 'hidden sm:table-cell' },
              { label: copy.columns.start, className: 'hidden md:table-cell' },
              { label: copy.columns.end, className: 'hidden md:table-cell' },
              { label: copy.columns.audience, className: 'hidden lg:table-cell' },
              { label: copy.columns.changes, className: 'hidden xl:table-cell' },
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
    </ProoflyListPage>
  )
}
