'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import NewProgramDialog from '@/components/apps/affiliates/new-program-dialog'
import ReferralProgramCard from '@/components/apps/affiliates/referral-program-card'
import { rateText } from '@/components/apps/affiliates/rule-label'
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import StatusChip from '@/components/layout/status-chip'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { affiliatesContent } from '@/data/affiliates'
import { affiliatesLayoutContent } from '@/data/affiliates-layout'
import { appsContent } from '@/data/apps'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { PAGE_FILL_CHAIN } from '@/lib/page-fill'
import { routes } from '@/lib/routes'

type Row = Awaited<ReturnType<typeof api.affiliates.programs.list>>[number]
type Tab = 'affiliate' | 'referral'

/**
 * Affiliates › Programs, laid out like UpPromote's: an Affiliate program | Referral program
 * switch (the referral one is our Share and earn), then the program list with name and Default
 * chip, type, amount, affiliates and the signup link.
 */
export default function ProgramsPage() {
  // Hooks
  const { programs: copy } = useCopy(affiliatesContent)
  const { programs: layout } = useCopy(affiliatesLayoutContent)
  const apps = useCopy(appsContent)
  const f = useFormat()
  const { data: rows, failed, retry } = useLoad(() => api.affiliates.programs.list())
  const [tab, setTab] = useState<Tab>('affiliate')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  // Render logic
  const cols = layout.columns
  const columns: ResourceColumnSpec<Row>[] = [
    {
      id: 'name',
      title: cols.name,
      hideable: false,
      align: 'start',
      className: 'w-60',
      sortValue: (r) => r.name,
      render: (r) => (
        <span className="flex flex-col items-start gap-1 text-left">
          <span className="font-medium">{r.name}</span>
          {r.isDefault ? <StatusChip tone="info">{copy.isDefault}</StatusChip> : null}
        </span>
      ),
    },
    {
      id: 'type',
      title: cols.type,
      render: (r) => layout.types[r.rules.commission.type] ?? r.rules.commission.type,
    },
    {
      id: 'amount',
      title: cols.amount,
      render: (r) => (
        <span className="flex flex-col text-left">
          <span>{rateText(r.rules.commission, f.money)}</span>
          {r.rules.levels.length > 0 ? (
            <span className="text-caption text-muted-foreground">
              {layout.tiered(r.rules.levels.length)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'affiliates',
      title: cols.affiliates,
      sortValue: (r) => r.affiliates,
      render: (r) => f.number(r.affiliates),
    },
    {
      id: 'link',
      title: cols.link,
      render: (r) => (
        <span className="font-mono">
          {r.isDefault ? '/affiliate' : `/affiliate?program=${r.slug}`}
        </span>
      ),
    },
    {
      id: 'status',
      title: cols.status,
      render: (r) =>
        r.archivedAt ? <StatusChip tone="neutral">{copy.archived}</StatusChip> : null,
    },
  ]
  const needle = query.trim().toLowerCase()
  const matching = (rows ?? []).filter(
    (r) => !needle || [r.name, r.slug].some((v) => v.toLowerCase().includes(needle)),
  )

  return (
    <div className={cn('flex flex-col gap-5', PAGE_FILL_CHAIN)}>
      <PillTabs
        variant="underline"
        label={layout.tabsLabel}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'affiliate', label: layout.tabs.affiliate },
          { value: 'referral', label: layout.tabs.referral },
        ]}
      />
      {tab === 'referral' ? (
        <ReferralProgramCard programs={rows ?? []} />
      ) : (
        <>
          <PageHeader
            title={layout.listTitle}
            summary={copy.subtitle}
            actions={<Button onClick={() => setAdding(true)}>{layout.add}</Button>}
          />
          <ResourceTable
            fill
            resourceName={copy.resource}
            columns={columns}
            items={matching}
            getId={(r) => r.id}
            href={(r) => routes.apps.page('affiliates', 'programs', r.id)}
            selectable={false}
            loading={rows === null && !failed}
            error={failed ? { heading: apps.couldNotLoad.programs, onRetry: retry } : undefined}
            query={query}
            onQueryChange={setQuery}
            page={1}
            perPage={Math.max(1, matching.length)}
            total={matching.length}
            onPageChange={() => {}}
            empty={{ heading: copy.subtitle }}
          />
        </>
      )}
      <NewProgramDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
