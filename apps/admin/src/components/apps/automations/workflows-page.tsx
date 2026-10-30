'use client'

import { siteConfig } from '@commerce/config/site'
import type { AutomationUsage, TriggerView, WorkflowSummary } from '@commerce/core/automations'
import { Blocks, ChevronLeftIcon, Plus, Workflow } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import type { FilterGroup } from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { automationPiecesContent, automationsContent } from '@/data/automations'
import { useAutomationCatalogue } from '@/hooks/use-automation-catalogue'
import { useCopy, useFormat, useLocale } from '@/hooks/use-copy'
import { automationApi } from '@/lib/automation-api'
import { triggerLabel } from '@/lib/automation-labels'
import { automationRoutes } from '@/lib/automation-routes'
import { routes } from '@/lib/routes'
import TriggerPickerDialog from './trigger-picker-dialog'
import UsageMeter from './usage-meter'
import { viewOf, type WorkflowView, workflowColumns } from './workflow-columns'
import WorkflowRowMenu from './workflow-row-menu'

/**
 * `?origin=growth` (Growth's link after cut-over) or `?origin=automations`; `?category=marketing`
 * reads as Growth's marketing automations too.
 */
const originOf = (params: { get: (name: string) => string | null }) => {
  const raw = params.get('origin')
  if (raw === 'growth' || raw === 'automations') return raw
  return params.get('category') === 'marketing' ? 'growth' : undefined
}

/** Automations home: every workflow with its trigger, status and recent runs, and the plan meter. */
export default function WorkflowsPage() {
  // Hooks
  const all = useCopy(automationsContent)
  const pieces = useCopy(automationPiecesContent)
  const locale = useLocale()
  const fmt = useFormat()
  const router = useRouter()
  const searchParams = useSearchParams()
  const catalogue = useAutomationCatalogue()
  const [items, setItems] = useState<WorkflowSummary[] | null>(null)
  const [usage, setUsage] = useState<AutomationUsage | null>(null)
  const [failed, setFailed] = useState(false)
  const [view, setView] = useState<WorkflowView | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [creating, setCreating] = useState(false)
  const [round, setRound] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `round` is the reload trigger after a row action
  useEffect(() => {
    let live = true
    Promise.all([automationApi.list(originOf(searchParams)), automationApi.usage()])
      .then(([list, use]) => {
        if (!live) return
        setItems(list)
        setUsage(use)
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [round, searchParams])

  // Helpers
  const count = (v: WorkflowView) => (items ?? []).filter((w) => viewOf(w) === v).length
  const reload = () => setRound((r) => r + 1)
  const triggerName = (id: string) =>
    triggerLabel(pieces, locale, catalogue?.triggers.find((t) => t.id === id) ?? null, id)

  // Event handlers
  const handleCreate = async (trigger: TriggerView) => {
    try {
      const w = await automationApi.create({ triggerType: trigger.id, name: all.create.untitled })
      router.push(automationRoutes.workflow(w.id))
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : all.list.row.failed)
    }
  }

  // Early returns
  if (failed) return <EmptyState variant="page" tone="danger" body={all.loadFailed} />

  // Render logic
  const copy = all.list
  const rows = items ?? []
  const origin = originOf(searchParams)
  const filterGroups: FilterGroup[] = [
    {
      key: 'origin',
      type: 'select',
      label: copy.originField,
      options: [
        { value: 'growth', label: copy.marketing },
        { value: 'automations', label: copy.originAutomations },
      ],
      value: origin ?? null,
      onChange: (next) =>
        router.push(
          automationRoutes.workflows(
            next === 'growth' || next === 'automations' ? next : undefined,
          ),
        ),
      anyLabel: copy.originAny,
    },
  ]
  const q = query.trim().toLowerCase()
  const filtered = rows.filter(
    (w) => (!view || viewOf(w) === view) && (!q || w.name.toLowerCase().includes(q)),
  )
  const shown = filtered.slice((page - 1) * perPage, page * perPage)
  const newButton = (
    <Button onClick={() => setCreating(true)} disabled={!catalogue}>
      <Plus aria-hidden="true" />
      {copy.newWorkflow}
    </Button>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {origin === 'growth' ? (
          <Button
            variant="ghost"
            className="mr-auto"
            nativeButton={false}
            render={<Link href={routes.growth.home()} />}
          >
            <ChevronLeftIcon aria-hidden="true" />
            {copy.backToGrowth}
          </Button>
        ) : null}
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={automationRoutes.templates()} />}
        >
          <Blocks aria-hidden="true" />
          {copy.browseTemplates}
        </Button>
        {newButton}
      </div>
      {usage ? <UsageMeter usage={usage} /> : null}
      {items !== null && rows.length === 0 ? (
        <EmptyState
          variant="page"
          icon={Workflow}
          heading={copy.empty.heading}
          body={copy.empty.body}
          action={
            <Button nativeButton={false} render={<Link href={automationRoutes.templates()} />}>
              {copy.empty.action}
            </Button>
          }
        />
      ) : (
        <ResourceTable
          resourceName={all.resource}
          columns={workflowColumns(copy, triggerName, fmt.number)}
          items={shown}
          getId={(w) => w.id}
          href={(w) => automationRoutes.workflow(w.id)}
          loading={items === null}
          rowActions={(w) => <WorkflowRowMenu workflow={w} onChanged={reload} />}
          query={query}
          onQueryChange={(next) => {
            setQuery(next)
            setPage(1)
          }}
          filterGroups={filterGroups}
          onClearAll={() => {
            if (origin) router.push(automationRoutes.workflows())
            setQuery('')
            setView(null)
            setPage(1)
          }}
          views={
            <ViewSelect
              value={view}
              label={copy.viewLabel}
              onChange={(next) => {
                setView(next)
                setPage(1)
              }}
              options={[
                { value: null, label: copy.views.all, count: rows.length },
                { value: 'active' as const, label: copy.views.active, count: count('active') },
                { value: 'paused' as const, label: copy.views.paused, count: count('paused') },
                { value: 'drafts' as const, label: copy.views.drafts, count: count('drafts') },
              ]}
            />
          }
          page={page}
          perPage={perPage}
          onPerPageChange={(next) => {
            setPerPage(next)
            setPage(1)
          }}
          total={filtered.length}
          onPageChange={setPage}
          selectable={false}
          empty={{ heading: copy.empty.heading, body: copy.empty.body }}
          noResults={{ heading: copy.noResults }}
        />
      )}
      {catalogue ? (
        <TriggerPickerDialog
          open={creating}
          onOpenChange={setCreating}
          catalogue={catalogue}
          title={all.create.title}
          description={all.create.body}
          onPick={(t) => {
            setCreating(false)
            void handleCreate(t)
          }}
        />
      ) : null}
    </div>
  )
}
