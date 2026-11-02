'use client'

import { siteConfig } from '@commerce/config/site'
import { API_AREAS } from '@commerce/core/api-access'
import { useEffect, useState } from 'react'
import { type ActivityRow, activityColumns } from '@/components/activity-log/activity-columns'
import ActivityDialog from '@/components/activity-log/activity-dialog'
import PageHeader from '@/components/layout/page-header'
import PageState from '@/components/states/page-state'
import {
  appliedFromGroups,
  clearGroups,
  type DateFilterValue,
  FILTER_PANEL_CLASS,
  type FilterGroup,
  FilterPanel,
} from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import { activityLogContent } from '@/data/activity-log'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { dateFilterBounds, NO_DATE_FILTER } from '@/lib/date-filter'
import { DAY_PRESETS, daysBackStart } from '@/lib/list-filter-groups'

type Person = Awaited<ReturnType<typeof api.activityLog.listPeople>>[number]
type Source = ActivityRow['source']

const SOURCES: Source[] = ['admin', 'assistant', 'mcp', 'api', 'worker', 'storefront']
/** The search box waits this long after the last key before asking the server. */
const SEARCH_DELAY_MS = 300

const isForbidden = (error: unknown) =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'FORBIDDEN'

/** Settings → Activity log: every change made to the store, filtered by person, area, source, words and dates. */
export default function ActivityLogPage() {
  // Hooks
  const copy = useCopy(activityLogContent)
  const panelCopy = useCopy(filterPanelContent)
  const [people, setPeople] = useState<Person[]>([])
  const [rows, setRows] = useState<ActivityRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [failure, setFailure] = useState<'forbidden' | 'failed' | null>(null)
  const [person, setPerson] = useState<string | null>(null)
  const [area, setArea] = useState<string | null>(null)
  const [source, setSource] = useState<string | null>(null)
  const [date, setDate] = useState<DateFilterValue>(NO_DATE_FILTER)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [open, setOpen] = useState<ActivityRow | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.activityLog
      .listPeople()
      .then((list) => {
        if (!cancelled) setPeople(list)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, SEARCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [query])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs it on Retry
  useEffect(() => {
    let cancelled = false
    const bounds = dateFilterBounds(date, daysBackStart)
    api.activityLog
      .list({
        ...(person ? { actorUserId: person } : {}),
        ...(area ? { area } : {}),
        ...(source ? { source: source as Source } : {}),
        ...(search ? { search } : {}),
        ...bounds,
        limit: perPage,
        offset: (page - 1) * perPage,
      })
      .then((r) => {
        if (cancelled) return
        setRows(r.rows)
        setTotal(r.total)
        setFailure(null)
      })
      .catch((error: unknown) => {
        if (!cancelled) setFailure(isForbidden(error) ? 'forbidden' : 'failed')
      })
    return () => {
      cancelled = true
    }
  }, [person, area, source, date, search, page, perPage, attempt])

  // Helpers
  const pick = (set: (v: string | null) => void) => (next: string | null) => {
    set(next)
    setPage(1)
  }

  // Event handlers
  const handleDate = (next: DateFilterValue) => {
    setDate(next)
    setPage(1)
  }
  const handlePerPage = (next: number) => {
    setPerPage(next)
    setPage(1)
  }
  const handleClearAll = () => {
    setQuery('')
    setPerson(null)
    setArea(null)
    setSource(null)
    setDate(NO_DATE_FILTER)
    setPage(1)
  }
  const handleRetry = () => {
    setFailure(null)
    setAttempt((n) => n + 1)
  }

  // Early returns
  if (failure === 'forbidden') {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader title={copy.title} summary={copy.intro} />
        <PageState kind="no-access" body={copy.noAccess} />
      </div>
    )
  }

  // Render logic
  const fl = copy.filters
  const groups: FilterGroup[] = [
    {
      key: 'person',
      label: fl.person,
      type: 'select',
      options: people.map((p) => ({
        value: p.userId,
        label: p.name && p.email ? `${p.name} (${p.email})` : (p.name ?? p.email ?? p.userId),
      })),
      value: person,
      onChange: pick(setPerson),
      anyLabel: fl.anyPerson,
    },
    {
      key: 'area',
      label: fl.area,
      type: 'select',
      options: API_AREAS.map((a) => ({ value: a, label: copy.areas[a] ?? a })),
      value: area,
      onChange: pick(setArea),
      anyLabel: fl.anyArea,
    },
    {
      key: 'source',
      label: fl.source,
      type: 'select',
      options: SOURCES.map((s) => ({ value: s, label: copy.sources[s] ?? s })),
      value: source,
      onChange: pick(setSource),
      anyLabel: fl.anySource,
    },
    {
      key: 'date',
      label: fl.date,
      type: 'date',
      presets: DAY_PRESETS.map((d) => ({ value: d, label: fl.dateOptions[d] })),
      value: date,
      onChange: handleDate,
      anyLabel: fl.anyDate,
    },
  ]
  const applied = appliedFromGroups(groups, panelCopy)
  const filtered = applied.length > 0 || search !== ''

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.title} summary={copy.intro} />
      {failure === 'failed' ? (
        <PageState kind="error" body={copy.failed} onRetry={handleRetry} />
      ) : (
        <ResourceTable
          resourceName={copy.resource}
          columns={activityColumns(copy, setOpen)}
          items={rows ?? []}
          getId={(r) => r.id}
          selectable={false}
          loading={rows === null}
          query={query}
          onQueryChange={setQuery}
          onClearAll={handleClearAll}
          filters={(close) => (
            <FilterPanel
              groups={groups}
              onClear={() => clearGroups(groups)}
              footer={{ label: panelCopy.show(total), onDone: close }}
            />
          )}
          filtersClassName={FILTER_PANEL_CLASS}
          applied={applied}
          page={page}
          perPage={perPage}
          total={total}
          onPageChange={setPage}
          onPerPageChange={handlePerPage}
          empty={{ heading: filtered ? copy.empty : copy.emptyAll }}
        />
      )}
      <ActivityDialog row={open} onClose={() => setOpen(null)} />
    </div>
  )
}
