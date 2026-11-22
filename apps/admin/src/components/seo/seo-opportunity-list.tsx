'use client'

import {
  SEO_APPLY_PERMISSION,
  SEO_ASSISTANT_LIMITS,
  type SeoAssistantRow,
} from '@commerce/core/seo-assistant'
import { AiIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import PillTabs from '@/components/layout/pill-tabs'
import SettingsCard from '@/components/settings/settings-card'
import { seoAssistantContent } from '@/data/seo-assistant'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import type { SeoFixTarget } from './seo-fix-dialog'
import SeoOpportunityRow from './seo-opportunity-row'

type SeoOpportunityListProps = {
  rows: SeoAssistantRow[]
  syncedAt: string | null
  aiOn: boolean
  onFix: (targets: SeoFixTarget[]) => void
}

type Filter = 'all' | 'band' | 'gaps'

const FILTERS: readonly Filter[] = ['all', 'band', 'gaps']
const PAGE = 25

const keyOf = (r: Pick<SeoAssistantRow, 'resource' | 'id'>) => `${r.resource}:${r.id}`

const toTarget = (r: SeoAssistantRow): SeoFixTarget => ({
  resource: r.resource,
  id: r.id,
  title: r.title,
  seoTitle: r.seoTitle,
  seoDescription: r.seoDescription,
})

/** The pages to improve, biggest chance first, filterable, with a selection for Fix with AI. */
export default function SeoOpportunityList({
  rows,
  syncedAt,
  aiOn,
  onFix,
}: SeoOpportunityListProps) {
  // Hooks
  const copy = useCopy(seoAssistantContent.list)
  const { hasPermission } = usePermissions()
  const [filter, setFilter] = useState<Filter>('all')
  const [shown, setShown] = useState(PAGE)
  const [selected, setSelected] = useState<string[]>([])

  // Helpers
  const mayEdit = (r: SeoAssistantRow) => hasPermission(SEO_APPLY_PERMISSION[r.resource])

  // Event handlers
  const handleFilter = (next: Filter) => {
    setFilter(next)
    setShown(PAGE)
  }
  const handleSelect = (row: SeoAssistantRow, on: boolean) =>
    setSelected((prev) => (on ? [...prev, keyOf(row)] : prev.filter((k) => k !== keyOf(row))))
  const handleFixSelected = () =>
    onFix(rows.filter((r) => selected.includes(keyOf(r))).map(toTarget))

  // Render logic
  const matching =
    filter === 'band'
      ? rows.filter((r) => r.inBand)
      : filter === 'gaps'
        ? rows.filter((r) => r.gaps.length > 0)
        : rows
  const visible = matching.slice(0, shown)
  const rest = matching.length - visible.length
  const room = selected.length < SEO_ASSISTANT_LIMITS.draftMax
  const synced = syncedAt ? new Date(syncedAt).toLocaleString('en-IN') : null

  return (
    <SettingsCard title={copy.heading} description={copy.body}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PillTabs
            variant="pill"
            label={copy.heading}
            tabs={FILTERS.map((f) => ({ value: f, label: copy.filters[f] }))}
            value={filter}
            onChange={handleFilter}
            className="flex-wrap"
          />
          {aiOn ? (
            <div className="flex items-center gap-2">
              <span className="text-caption text-muted-foreground">
                {copy.selectMax(SEO_ASSISTANT_LIMITS.draftMax)}
              </span>
              <Button disabled={selected.length === 0} onClick={handleFixSelected}>
                <AiIcon className="size-4" />
                {copy.fixSelected(selected.length)}
              </Button>
            </div>
          ) : null}
        </div>
        {!aiOn ? <p className="text-body text-muted-foreground">{copy.aiOff}</p> : null}
        {synced ? (
          <p className="text-caption text-muted-foreground">{copy.synced(synced)}</p>
        ) : null}
        {matching.length === 0 ? (
          <EmptyState variant="inline" body={copy.empty} />
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {visible.map((row) => {
              const isSelected = selected.includes(keyOf(row))
              const canFix = aiOn && mayEdit(row)
              return (
                <SeoOpportunityRow
                  key={keyOf(row)}
                  row={row}
                  selected={isSelected}
                  selectable={canFix && room}
                  canFix={canFix}
                  onSelect={(on) => handleSelect(row, on)}
                  onFix={() => onFix([toTarget(row)])}
                />
              )
            })}
          </ul>
        )}
        {rest > 0 ? (
          <Button variant="outline" onClick={() => setShown((n) => n + PAGE)} className="self-end">
            {copy.more(Math.min(rest, PAGE))}
          </Button>
        ) : null}
      </div>
    </SettingsCard>
  )
}
