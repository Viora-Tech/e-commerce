'use client'

import { siteConfig } from '@commerce/config/site'
import { Braces, Plus, SquarePlus } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Tooltip, TooltipContent, TooltipTrigger } from '@commerce/ui/shadcn/tooltip'
import Link from 'next/link'
import { useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { metaobjectListContent } from '@/data/metaobjects'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'
import { type DefinitionSummary, entriesPath } from './form-state'

type DefinitionsPageProps = { definitions: DefinitionSummary[] }

type ListCopy = typeof metaobjectListContent

const columnsFor = (
  copy: ListCopy,
  fmt: ReturnType<typeof useFormat>,
): ResourceColumnSpec<DefinitionSummary>[] => [
  {
    id: 'name',
    title: copy.columns.type,
    sortValue: (d) => d.name,
    hideable: false,
    align: 'start',
    className: 'w-80 px-3 whitespace-normal',
    render: (d) => (
      <span className="flex flex-col text-left">
        <span className="flex items-center gap-2">
          <span className="font-medium text-ink-strong">{d.name}</span>
          {d.storefrontAccess ? null : <Badge variant="neutral">{copy.hidden}</Badge>}
        </span>
        <span className="text-caption text-muted-foreground">{d.type}</span>
      </span>
    ),
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
    render: (d) => <span className="tabular-nums">{copy.entryCount(d.entries)}</span>,
  },
  {
    id: 'updated',
    title: copy.columns.updated,
    sortValue: (d) => new Date(d.updatedAt),
    align: 'end',
    render: (d) => <span className="text-muted-foreground">{fmt.when(d.updatedAt)}</span>,
  },
]

/** Content → Content types: every metaobject definition, or an empty state that starts the guided flow. */
export default function DefinitionsPage({ definitions }: DefinitionsPageProps) {
  // Hooks
  const copy = useCopy(metaobjectListContent)
  const fmt = useFormat()
  usePrimaryAction(routes.content.newBlankContentType())
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)

  // Event handlers
  const handleQuery = (next: string) => {
    setQuery(next)
    setPage(1)
  }

  const handlePerPage = (next: number) => {
    setPerPage(next)
    setPage(1)
  }

  // Render logic
  const columns = columnsFor(copy, fmt)
  const q = query.trim().toLowerCase()
  const matching = q
    ? definitions.filter((d) => d.name.toLowerCase().includes(q) || d.type.includes(q))
    : definitions
  const shown = matching.slice((page - 1) * perPage, page * perPage)
  const entries = definitions.reduce((n, d) => n + d.entries, 0)
  const addButton = (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            render={<Link href={routes.content.newBlankContentType()} />}
            nativeButton={false}
          >
            <SquarePlus strokeWidth={1.6} />
            {copy.add}
          </Button>
        }
      />
      <TooltipContent>
        {copy.add} <Kbd>N</Kbd>
      </TooltipContent>
    </Tooltip>
  )

  return (
    <ProoflyListPage
      title={copy.heading}
      summary={copy.summary(definitions.length, entries)}
      actions={
        <>
          <Button
            variant="key-neutral"
            render={<Link href={routes.content.newContentType()} />}
            nativeButton={false}
          >
            {copy.fromTemplate}
          </Button>
          {addButton}
        </>
      }
    >
      {definitions.length === 0 ? (
        <div className="rounded-2xl border surface-card">
          <EmptyState
            icon={Braces}
            heading={copy.empty.heading}
            body={copy.empty.body}
            action={
              <Button render={<Link href={routes.content.newContentType()} />} nativeButton={false}>
                <Plus />
                {copy.add}
              </Button>
            }
          />
        </div>
      ) : (
        <ResourceTable
          resourceName={copy.resource}
          columns={columns}
          items={shown}
          getId={(d) => d.id}
          href={(d) => entriesPath(d.type)}
          selectable={false}
          query={query}
          onQueryChange={handleQuery}
          page={page}
          perPage={perPage}
          total={matching.length}
          onPageChange={setPage}
          onPerPageChange={handlePerPage}
        />
      )}
    </ProoflyListPage>
  )
}
