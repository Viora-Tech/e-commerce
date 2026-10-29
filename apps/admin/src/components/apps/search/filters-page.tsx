'use client'

import type { FilterSources } from '@commerce/core'
import {
  type FilterGroupConfig,
  groupId,
  MAX_FILTER_GROUPS,
  type StorefrontFilterConfig,
} from '@commerce/core/filter-config'
import { Plus, RotateCcw, Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SettingsCard from '@/components/settings/settings-card'
import { searchFiltersContent } from '@/data/search-filters'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  choiceDetail,
  choiceName,
  defaultFilterGroups,
  filterChoices,
} from '@/lib/search-filter-options'
import AddFilterDialog from './add-filter-dialog'
import FilterGroupRow from './filter-group-row'

type Loaded = { config: StorefrontFilterConfig | null; sources: FilterSources }

/** What is saved for a list: groups with blank labels dropped, for the dirty check. */
const snapshot = (groups: FilterGroupConfig[]): string =>
  JSON.stringify(
    groups.map((g) => ({ source: g.source, key: g.key, label: g.label?.trim() || undefined })),
  )

/**
 * The Search & discovery app's Filters page, Shopify's filter settings: which filters collection
 * and search pages show, in order, each with the name shoppers see. A full page with an add
 * dialog (never a side drawer).
 */
export default function FiltersPage() {
  // Hooks
  const copy = useCopy(searchFiltersContent)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [groups, setGroups] = useState<FilterGroupConfig[]>([])
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.search.filters.get().then((data) => {
      setLoaded(data)
      setGroups(data.config?.groups ?? defaultFilterGroups(data.sources))
    })
  }, [])

  // Helpers
  const persist = async (config: StorefrontFilterConfig | null, message: string) => {
    if (!loaded) return
    setSaving(true)
    try {
      const saved = await api.search.filters.set({ config })
      setLoaded({ ...loaded, config: saved })
      setGroups(saved?.groups ?? defaultFilterGroups(loaded.sources))
      toast.success(message)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Event handlers
  const handleLabel = (index: number, label: string) =>
    setGroups(groups.map((g, i) => (i === index ? { ...g, label } : g)))

  const handleMove = (index: number, by: -1 | 1) => {
    const next = [...groups]
    const [moved] = next.splice(index, 1)
    if (!moved) return
    next.splice(index + by, 0, moved)
    setGroups(next)
  }

  const handleRemove = (index: number) => setGroups(groups.filter((_, i) => i !== index))

  const handleAdd = (group: FilterGroupConfig) => {
    if (groups.some((g) => groupId(g) === groupId(group))) return
    setGroups([...groups, group])
  }

  const handleSave = () =>
    persist(
      {
        groups: groups.map((g) => ({
          source: g.source,
          ...(g.key ? { key: g.key } : {}),
          ...(g.label?.trim() ? { label: g.label.trim() } : {}),
        })),
      },
      copy.list.saved,
    )

  const handleReset = () => persist(null, copy.list.resetDone)

  // Early returns
  if (!loaded) return null

  // Render logic
  const choices = filterChoices(loaded.sources, copy)
  const taken = new Set(groups.map(groupId))
  const open = choices.filter((c) => !taken.has(c.id))
  const baseline = loaded.config?.groups ?? defaultFilterGroups(loaded.sources)
  const dirty = snapshot(groups) !== snapshot(baseline)
  const full = groups.length >= MAX_FILTER_GROUPS

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.title} summary={copy.subtitle} />
      <SettingsCard
        title={copy.list.title}
        description={copy.list.description}
        footer={
          <>
            {loaded.config ? (
              <Button variant="outline" disabled={saving} onClick={handleReset}>
                <RotateCcw aria-hidden="true" />
                {copy.list.reset}
              </Button>
            ) : null}
            <Button loading={saving} disabled={saving || !dirty} onClick={handleSave}>
              <Save aria-hidden="true" />
              {copy.list.save}
            </Button>
          </>
        }
      >
        {loaded.config ? null : (
          <p className="rounded-md bg-muted px-3 py-2 text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
            {copy.list.usingDefault}
          </p>
        )}
        {groups.length === 0 ? (
          <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
            {copy.list.empty}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {groups.map((g, i) => {
              const id = groupId(g)
              return (
                <FilterGroupRow
                  key={id}
                  id={id.replace(/[^a-z0-9]+/gi, '-')}
                  name={choiceName(g, choices, copy)}
                  detail={choiceDetail(g, choices, copy)}
                  label={g.label ?? ''}
                  first={i === 0}
                  last={i === groups.length - 1}
                  onLabel={(label) => handleLabel(i, label)}
                  onMove={(by) => handleMove(i, by)}
                  onRemove={() => handleRemove(i)}
                />
              )
            })}
          </ul>
        )}
        <div>
          <Button variant="outline" disabled={full} onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" />
            {copy.list.add}
          </Button>
        </div>
      </SettingsCard>
      <AddFilterDialog open={adding} onOpenChange={setAdding} choices={open} onAdd={handleAdd} />
    </div>
  )
}
