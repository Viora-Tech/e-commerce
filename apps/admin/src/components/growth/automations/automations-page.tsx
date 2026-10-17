'use client'

import { siteConfig } from '@commerce/config/site'
import { AUTOMATION_TEMPLATES, type AutomationTemplateId } from '@commerce/core/marketing'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import SectionHead from '@/components/layout/section-head'
import ResourceTable from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import ViewSelect from '@/components/table/view-select'
import { automationsContent } from '@/data/marketing-automations'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { automationColumns } from './automation-columns'

type Item = Awaited<ReturnType<typeof api.marketing.automations.list>>[number]

type AutomationsPageProps = { automations: Item[] }

/** Growth > Automations: the store's automations with results, then the template gallery. */
export default function AutomationsPage({ automations }: AutomationsPageProps) {
  // Hooks
  const copy = useCopy(automationsContent)
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [tab, setTab] = useState<Item['status'] | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)

  // Event handlers
  const handleUse = async (template: AutomationTemplateId) => {
    setBusy(template)
    try {
      const row = await api.marketing.automations.create({ template })
      toast.success(copy.created)
      router.push(routes.growth.automation(row.id))
    } finally {
      setBusy(null)
    }
  }

  const handleBrowse = () =>
    document.getElementById('automation-templates')?.scrollIntoView({ behavior: 'smooth' })

  // Render logic
  const used = (id: string) => automations.filter((a) => a.template === id).length
  const running = automations.filter((a) => a.status === 'active').length
  const orders = automations.reduce((n, a) => n + a.stats.orders, 0)
  const q = query.trim().toLowerCase()
  const filtered = automations.filter(
    (a) => (!tab || a.status === tab) && (!q || a.name.toLowerCase().includes(q)),
  )
  const items = filtered.slice((page - 1) * perPage, page * perPage)
  const back = { label: copy.back, href: routes.growth.home() }

  return (
    <ProoflyListPage
      title={copy.title}
      summary={
        automations.length === 0 ? copy.intro : copy.summary(automations.length, running, orders)
      }
      back={back}
      actions={
        <>
          <Button variant="outline" onClick={handleBrowse}>
            {copy.browseTemplates}
          </Button>
          <Button onClick={handleBrowse}>
            <Plus strokeWidth={1.6} />
            {copy.newAutomation}
          </Button>
        </>
      }
    >
      {automations.length > 0 ? (
        <ResourceTable
          resourceName={copy.resource}
          columns={automationColumns(copy)}
          items={items}
          getId={(a) => a.id}
          href={(a) => routes.growth.automation(a.id)}
          rowActions={(a) => (
            <RowMenu items={[{ label: copy.open, href: routes.growth.automation(a.id) }]} />
          )}
          query={query}
          onQueryChange={(next) => {
            setQuery(next)
            setPage(1)
          }}
          onClearAll={() => {
            setQuery('')
            setTab(null)
            setPage(1)
          }}
          views={
            <ViewSelect
              value={tab}
              onChange={(next) => {
                setTab(next)
                setPage(1)
              }}
              options={[
                { value: null, label: copy.tabs.all, count: automations.length },
                { value: 'active' as const, label: copy.tabs.active, count: running },
                {
                  value: 'paused' as const,
                  label: copy.tabs.paused,
                  count: automations.length - running,
                },
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
          empty={{ heading: copy.empty }}
        />
      ) : null}
      <section id="automation-templates" className="flex scroll-mt-6 flex-col gap-3">
        <SectionHead title={copy.templatesTitle} intro={copy.templatesIntro} />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {AUTOMATION_TEMPLATES.map((t) => (
            <Card key={t.id} gap={4} inset={4} className="justify-between">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-body-strong">{t.name}</p>
                  <span className="text-caption text-muted-foreground">
                    {copy.templateChannels[t.id]}
                  </span>
                </div>
                <p className="text-caption text-muted-foreground">{t.description}</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-caption text-muted-foreground">
                  {used(t.id) ? copy.inUse(used(t.id)) : ''}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUse(t.id)}
                  disabled={busy !== null}
                >
                  {copy.use}
                </Button>
              </div>
            </Card>
          ))}
        </div>
        <p className="text-caption text-muted-foreground">{copy.browseNote}</p>
      </section>
    </ProoflyListPage>
  )
}
