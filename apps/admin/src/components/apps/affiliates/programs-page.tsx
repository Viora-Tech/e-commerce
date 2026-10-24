'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import NewProgramDialog from '@/components/apps/affiliates/new-program-dialog'
import { ruleLabel } from '@/components/apps/affiliates/rule-label'
import PageHeader from '@/components/layout/page-header'
import StatusChip from '@/components/layout/status-chip'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { affiliatesContent } from '@/data/affiliates'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Row = Awaited<ReturnType<typeof api.affiliates.programs.list>>[number]

/** Every program: its signup link, rate and how many affiliates are in it. */
export default function ProgramsPage() {
  // Hooks
  const { programs: copy } = useCopy(affiliatesContent)
  const f = useFormat()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.affiliates.programs.list().then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Render logic
  const columns: ResourceColumnSpec<Row>[] = [
    {
      id: 'name',
      title: copy.columns.name,
      hideable: false,
      align: 'start',
      className: 'w-60',
      sortValue: (r) => r.name,
      render: (r) => <span className="font-medium">{r.name}</span>,
    },
    {
      id: 'link',
      title: copy.columns.link,
      render: (r) => (
        <span className="font-mono">
          {r.isDefault ? '/affiliate' : `/affiliate?program=${r.slug}`}
        </span>
      ),
    },
    {
      id: 'commission',
      title: copy.columns.commission,
      render: (r) => ruleLabel(r.rules.commission, copy, f.money),
    },
    {
      id: 'affiliates',
      title: copy.columns.affiliates,
      sortValue: (r) => r.affiliates,
      render: (r) => f.number(r.affiliates),
    },
    {
      id: 'status',
      title: copy.columns.status,
      render: (r) =>
        r.archivedAt ? (
          <StatusChip tone="neutral">{copy.archived}</StatusChip>
        ) : r.isDefault ? (
          <StatusChip tone="info">{copy.isDefault}</StatusChip>
        ) : null,
    },
  ]
  const needle = query.trim().toLowerCase()
  const matching = (rows ?? []).filter(
    (r) => !needle || [r.name, r.slug].some((v) => v.toLowerCase().includes(needle)),
  )

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title}
        summary={copy.subtitle}
        actions={<Button onClick={() => setAdding(true)}>{copy.add}</Button>}
      />
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={matching}
        getId={(r) => r.id}
        href={(r) => routes.apps.page('affiliates', 'programs', r.id)}
        selectable={false}
        loading={rows === null}
        query={query}
        onQueryChange={setQuery}
        page={1}
        perPage={Math.max(1, matching.length)}
        total={matching.length}
        onPageChange={() => {}}
        empty={{ heading: copy.subtitle }}
      />
      <NewProgramDialog open={adding} onOpenChange={setAdding} />
    </div>
  )
}
