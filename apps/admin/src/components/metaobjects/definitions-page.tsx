'use client'

import { Braces, Plus, Settings, SquarePlus } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useState } from 'react'
import KitListPage from '@/components/kit/kit-list-page'
import EmptyState from '@/components/layout/empty-state'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { metaobjectListContent as copy } from '@/data/metaobjects'
import { formatWhen } from '@/lib/format-date'
import { type DefinitionSummary, entriesPath } from './form-state'

type DefinitionsPageProps = { definitions: DefinitionSummary[] }

const columns: ResourceColumnSpec<DefinitionSummary>[] = [
  {
    id: 'name',
    title: copy.columns.name,
    sortValue: (d) => d.name,
    hideable: false,
    align: 'start',
    className: 'w-80 px-3 whitespace-normal',
    render: (d) => (
      <span className="flex flex-col text-left">
        <span className="flex items-center gap-2">
          <span className="text-body-strong">{d.name}</span>
          {d.storefrontAccess ? null : <Badge variant="neutral">{copy.hidden}</Badge>}
        </span>
        {d.description ? (
          <span className="line-clamp-1 text-caption text-muted-foreground">{d.description}</span>
        ) : null}
      </span>
    ),
  },
  {
    id: 'type',
    title: copy.columns.type,
    sortValue: (d) => d.type,
    render: (d) => <span className="font-mono text-caption">{d.type}</span>,
  },
  {
    id: 'fields',
    title: copy.columns.fields,
    sortValue: (d) => d.fields.length,
    render: (d) => copy.fieldCount(d.fields.length),
  },
  {
    id: 'entries',
    title: copy.columns.entries,
    sortValue: (d) => d.entries,
    render: (d) => <span className="tabular-nums">{d.entries}</span>,
  },
  {
    id: 'updated',
    title: copy.columns.updated,
    sortValue: (d) => new Date(d.updatedAt),
    render: (d) => formatWhen(d.updatedAt),
  },
]

/** Content → Metaobjects: every definition, or a real empty state that explains them. */
export default function DefinitionsPage({ definitions }: DefinitionsPageProps) {
  // Hooks
  const [query, setQuery] = useState('')

  // Render logic
  const q = query.trim().toLowerCase()
  const shown = q
    ? definitions.filter((d) => d.name.toLowerCase().includes(q) || d.type.includes(q))
    : definitions
  const addButton = (
    <Button size="lg" render={<Link href="/content/metaobjects/new" />} nativeButton={false}>
      <SquarePlus strokeWidth={1.6} />
      {copy.add}
    </Button>
  )

  return (
    <KitListPage
      title={copy.heading}
      actions={
        <>
          <Button
            variant="outline"
            size="lg"
            render={<Link href="/settings/custom-data" />}
            nativeButton={false}
          >
            <Settings strokeWidth={1.6} />
            {copy.customData}
          </Button>
          {definitions.length > 0 ? addButton : null}
        </>
      }
    >
      {definitions.length === 0 ? (
        <Card>
          <EmptyState
            icon={Braces}
            heading={copy.empty.heading}
            body={copy.empty.body}
            action={
              <Button render={<Link href="/content/metaobjects/new" />} nativeButton={false}>
                <Plus />
                {copy.add}
              </Button>
            }
          />
        </Card>
      ) : (
        <ResourceTable
          size="frame"
          resourceName={copy.resource}
          columns={columns}
          items={shown}
          getId={(d) => d.id}
          href={(d) => entriesPath(d.type)}
          selectable={false}
          query={query}
          onQueryChange={setQuery}
          page={1}
          perPage={Math.max(shown.length, 1)}
          total={shown.length}
          onPageChange={() => {}}
        />
      )}
    </KitListPage>
  )
}
