'use client'

import {
  Card,
  EmptyState,
  IndexFilters,
  type IndexFiltersProps,
  IndexTable,
  type IndexTableProps,
  Pagination,
  Text,
  useIndexResourceState,
  useSetIndexFiltersMode,
} from '@shopify/polaris'
import type { ReactNode } from 'react'

export type ResourceTableColumn<T> = {
  id: string
  title: string
  alignment?: 'start' | 'center' | 'end'
  render: (item: T) => ReactNode
}

export type ResourceTableFilter = {
  key: string
  label: string
  filter: ReactNode
  /** Chip text shown when applied; null hides the chip. */
  appliedLabel: string | null
  onRemove: () => void
}

export type ResourceTableProps<T> = {
  resourceName: { singular: string; plural: string }
  columns: ResourceTableColumn<T>[]
  items: T[]
  getId: (item: T) => string
  onRowClick?: (item: T) => void
  loading?: boolean
  // search + filters
  query: string
  onQueryChange: (q: string) => void
  filters?: ResourceTableFilter[]
  onClearAll?: () => void
  // paging
  page: number
  perPage: number
  total: number
  onPageChange: (page: number) => void
  // selection
  selectable?: boolean
  bulkActions?: (selectedIds: string[], clear: () => void) => IndexTableProps['bulkActions']
  empty?: { heading: string; body: string }
}

/**
 * The one table. Every admin list page renders through this so search,
 * filters, selection, empty states and paging look and behave the same.
 * Wraps Polaris IndexFilters + IndexTable, the same pair Shopify admin uses.
 */
export function ResourceTable<T>(props: ResourceTableProps<T>) {
  const { mode, setMode } = useSetIndexFiltersMode()
  const resources = props.items.map((i) => ({ id: props.getId(i) }))
  const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } =
    useIndexResourceState(resources)
  const totalPages = Math.max(1, Math.ceil(props.total / props.perPage))

  const applied: IndexFiltersProps['appliedFilters'] = (props.filters ?? [])
    .filter((f) => f.appliedLabel)
    .map((f) => ({ key: f.key, label: f.appliedLabel as string, onRemove: f.onRemove }))

  const emptyState = props.items.length === 0 && !props.loading && (
    <EmptyState heading={props.empty?.heading ?? `No ${props.resourceName.plural} yet`} image="">
      <p>{props.empty?.body ?? 'Try a different search or clear the filters.'}</p>
    </EmptyState>
  )

  return (
    <Card padding="0">
      <IndexFilters
        queryValue={props.query}
        queryPlaceholder={`Search ${props.resourceName.plural}`}
        onQueryChange={props.onQueryChange}
        onQueryClear={() => props.onQueryChange('')}
        filters={(props.filters ?? []).map((f) => ({
          key: f.key,
          label: f.label,
          filter: f.filter,
          shortcut: true,
        }))}
        appliedFilters={applied}
        onClearAll={props.onClearAll ?? (() => props.onQueryChange(''))}
        mode={mode}
        setMode={setMode}
        tabs={[]}
        selected={0}
        canCreateNewView={false}
        cancelAction={{ onAction: () => setMode('DEFAULT' as typeof mode) }}
        loading={props.loading}
      />
      <IndexTable
        resourceName={props.resourceName}
        itemCount={props.items.length}
        selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
        onSelectionChange={handleSelectionChange}
        selectable={props.selectable ?? true}
        headings={
          props.columns.map((c) => ({
            id: c.id,
            title: c.title,
            alignment: c.alignment,
          })) as IndexTableProps['headings']
        }
        bulkActions={props.bulkActions?.(selectedResources, clearSelection)}
        loading={props.loading}
        emptyState={emptyState || undefined}
      >
        {props.items.map((item, index) => {
          const id = props.getId(item)
          return (
            <IndexTable.Row
              id={id}
              key={id}
              position={index}
              selected={selectedResources.includes(id)}
              onClick={props.onRowClick ? () => props.onRowClick?.(item) : undefined}
            >
              {props.columns.map((c) => (
                <IndexTable.Cell key={c.id}>{c.render(item)}</IndexTable.Cell>
              ))}
            </IndexTable.Row>
          )
        })}
      </IndexTable>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
        }}
      >
        <Text as="span" tone="subdued" variant="bodySm">
          {props.total === 0
            ? 'No results'
            : `${(props.page - 1) * props.perPage + 1}–${Math.min(props.page * props.perPage, props.total)} of ${props.total}`}
        </Text>
        <Pagination
          hasPrevious={props.page > 1}
          hasNext={props.page < totalPages}
          onPrevious={() => props.onPageChange(props.page - 1)}
          onNext={() => props.onPageChange(props.page + 1)}
        />
      </div>
    </Card>
  )
}
