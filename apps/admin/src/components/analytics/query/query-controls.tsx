'use client'

import {
  dimensionsOf,
  metricsOf,
  type ParsedQuery,
  QUERY_LIMIT_MAX,
  QUERY_TABLE_NAMES,
  type QueryTable,
  setGroupBy,
  setLimit,
  setOrderBy,
  setTable,
  toggleMetric,
} from '@commerce/core/analytics-query'
import { CircleAlert } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Input } from '@commerce/ui/shadcn/input'
import { Label } from '@commerce/ui/shadcn/label'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useId } from 'react'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'

type QueryControlsProps = {
  /** The query the controls edit, or the last one that parsed while the text has a problem. */
  query: ParsedQuery
  /** False while the text does not parse: the controls show, greyed, with a note. */
  enabled: boolean
  onChange: (next: ParsedQuery) => void
}

const LABEL = 'text-caption font-medium text-muted-foreground'

/**
 * The query's clauses as form controls (Shopify's ShopifyQL editor side panel): table,
 * metrics, dimension, sort and limit. Each edit goes through core's control helpers, so the
 * text it writes back always parses.
 */
export default function QueryControls({ query, enabled, onChange }: QueryControlsProps) {
  // Hooks
  const copy = useCopy(analyticsContent.query)
  const id = useId()

  // Event handlers
  const handleSort = (field: string) =>
    onChange(setOrderBy(query, field || null, query.orderBy?.dir ?? 'desc'))

  const handleLimit = (raw: string) => {
    const n = Number(raw)
    if (raw && Number.isFinite(n)) onChange(setLimit(query, n))
  }

  // Render logic
  const metrics = metricsOf(query.table)
  const dims = dimensionsOf(query.table)
  const sortable = [...query.show, ...(query.groupBy ? [query.groupBy] : [])]

  return (
    <div className="flex flex-col gap-3">
      {enabled ? null : (
        <p className="flex items-start gap-1.5 rounded-md bg-muted px-2.5 py-2 text-caption text-muted-foreground">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {copy.controls.fixFirst}
        </p>
      )}
      <fieldset
        disabled={!enabled}
        className={cn('flex flex-col gap-4', !enabled && 'pointer-events-none opacity-50')}
      >
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-table`} className={LABEL}>
            {copy.controls.table}
          </label>
          <NativeSelect
            id={`${id}-table`}
            size="sm"
            className="w-full"
            value={query.table}
            onChange={(e) => onChange(setTable(query, e.target.value as QueryTable))}
          >
            {QUERY_TABLE_NAMES.map((t) => (
              <NativeSelectOption key={t} value={t}>
                {t}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <p className={LABEL} id={`${id}-metrics`}>
            {copy.controls.metrics}
          </p>
          <ul aria-labelledby={`${id}-metrics`} className="flex flex-col gap-1">
            {metrics.map((m) => {
              const on = query.show.includes(m.name)
              return (
                <li key={m.name}>
                  <Label
                    className="flex items-center gap-2 py-0.5 font-normal"
                    title={m.description}
                  >
                    <Checkbox
                      checked={on}
                      disabled={!enabled || (on && query.show.length === 1)}
                      onCheckedChange={() => onChange(toggleMetric(query, m.name))}
                    />
                    <span className="min-w-0 flex-1 truncate font-mono text-caption">{m.name}</span>
                    <span className="shrink-0 text-caption text-muted-foreground">
                      {copy.types[m.type]}
                    </span>
                  </Label>
                </li>
              )
            })}
          </ul>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-dim`} className={LABEL}>
            {copy.controls.dimension}
          </label>
          <NativeSelect
            id={`${id}-dim`}
            size="sm"
            className="w-full"
            value={query.groupBy ?? ''}
            onChange={(e) => onChange(setGroupBy(query, e.target.value || null))}
          >
            <NativeSelectOption value="">{copy.controls.none}</NativeSelectOption>
            {dims.map((d) => (
              <NativeSelectOption key={d.name} value={d.name}>
                {d.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-sort`} className={LABEL}>
            {copy.controls.sort}
          </label>
          <div className="flex gap-2">
            <NativeSelect
              id={`${id}-sort`}
              size="sm"
              className="min-w-0 flex-1"
              value={query.orderBy?.field ?? ''}
              onChange={(e) => handleSort(e.target.value)}
            >
              <NativeSelectOption value="">{copy.controls.noSort}</NativeSelectOption>
              {sortable.map((f) => (
                <NativeSelectOption key={f} value={f}>
                  {f}
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <NativeSelect
              size="sm"
              aria-label={copy.controls.direction}
              disabled={!enabled || !query.orderBy}
              value={query.orderBy?.dir ?? 'desc'}
              onChange={(e) =>
                onChange(setOrderBy(query, query.orderBy?.field ?? null, e.target.value as 'asc'))
              }
            >
              <NativeSelectOption value="desc">{copy.controls.desc}</NativeSelectOption>
              <NativeSelectOption value="asc">{copy.controls.asc}</NativeSelectOption>
            </NativeSelect>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-limit`} className={LABEL}>
            {copy.controls.limit}
          </label>
          <Input
            id={`${id}-limit`}
            type="number"
            inputMode="numeric"
            min={1}
            max={QUERY_LIMIT_MAX}
            className="w-28"
            value={query.limit}
            onChange={(e) => handleLimit(e.target.value)}
          />
        </div>
      </fieldset>
    </div>
  )
}
