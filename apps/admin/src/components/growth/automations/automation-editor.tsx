'use client'

import {
  type AutomationSettings,
  type AutomationStep,
  type AutomationStepType,
  type AutomationTrigger,
  minutesBefore,
  parseAutomationSettings,
  parseAutomationSteps,
  TRIGGER_HAS_CART,
} from '@commerce/core/marketing'
import { formatNumber } from '@commerce/money'
import { ArrowRight, ChevronLeftIcon, CircleAlert, Trash2, X } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { blockId } from '@/components/growth/campaigns/form-state'
import type { TemplatesResult } from '@/components/growth/campaigns/whatsapp-template-card'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PillTabs from '@/components/layout/pill-tabs'
import SaveBar from '@/components/layout/save-bar'
import StatusChip from '@/components/layout/status-chip'
import { automationEditorContent as copy } from '@/data/marketing-automations'
import { campaignReportContent } from '@/data/marketing-campaigns'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import AutomationFlow from './automation-flow'
import AutomationPalette from './automation-palette'
import AutomationRunsCard from './automation-runs-card'
import AutomationStepCard from './automation-step-card'
import AutomationTestPanel from './automation-test-panel'
import AutomationTriggerCard from './automation-trigger-card'

type Loaded = NonNullable<Awaited<ReturnType<typeof api.marketing.automations.get>>>

type AutomationEditorProps = {
  automation: Loaded
  storeName: string
  storefrontUrl: string
}

type Form = { name: string; steps: AutomationStep[]; settings: AutomationSettings }

function newStep(type: AutomationStepType): AutomationStep {
  const id = blockId()
  if (type === 'wait') return { id, type, minutes: 60 }
  if (type === 'condition') return { id, type, field: 'cart_value', op: 'gte', value: '1000' }
  if (type === 'whatsapp')
    return { id, type, template: { name: '', language: 'en', variables: [] } }
  return {
    id,
    type,
    subject: '',
    previewText: '',
    blocks: [
      { id: `${id}-h`, type: 'header' },
      { id: `${id}-t`, type: 'text', text: '', align: 'left' },
    ],
  }
}

function fromAutomation(a: Loaded): Form {
  return {
    name: a.name,
    steps: parseAutomationSteps(a.steps),
    settings: parseAutomationSettings(a.settings),
  }
}

/** Shopify-style automation page: on/off, results, trigger settings and the step sequence. */
export default function AutomationEditor({
  automation,
  storeName,
  storefrontUrl,
}: AutomationEditorProps) {
  // Hooks
  const router = useRouter()
  const [start] = useState(() => fromAutomation(automation))
  const [form, setForm] = useState(start)
  const [saved, setSaved] = useState(() => JSON.stringify(start))
  const [active, setActive] = useState(automation.status === 'active')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [templates, setTemplates] = useState<TemplatesResult | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [selected, setSelected] = useState('trigger')
  const [tab, setTab] = useState<'builder' | 'results'>('builder')
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (!form.steps.some((s) => s.type === 'whatsapp') || templates) return
    api.marketing.campaigns.whatsappTemplates().then(setTemplates)
  }, [form.steps, templates])

  // Helpers
  const setSteps = (steps: AutomationStep[]) => setForm((f) => ({ ...f, steps }))

  // Event handlers
  const handleInsert = (type: AutomationStepType, index: number) => {
    const step = newStep(type)
    setSteps([...form.steps.slice(0, index), step, ...form.steps.slice(index)])
    setSelected(step.id)
    setTesting(false)
  }

  const handleSave = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.marketing.automations.update({ id: automation.id, data: form })
      setSaved(JSON.stringify(form))
      toast.success(copy.saved)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleToggle = async (on: boolean) => {
    setActive(on)
    try {
      await api.marketing.automations.setStatus({
        id: automation.id,
        status: on ? 'active' : 'paused',
      })
      toast.success(on ? copy.turnedOn : copy.turnedOff)
    } catch (err) {
      setActive(!on)
      setError(err instanceof Error ? err.message : copy.failed)
    }
  }

  const handleDelete = async () => {
    setBusy(true)
    await api.marketing.automations.delete({ id: automation.id })
    toast.success(copy.deleted)
    router.push(routes.growth.automations())
    router.refresh()
  }

  // Render logic
  const trigger = automation.trigger as AutomationTrigger
  const selectedIndex = form.steps.findIndex((x) => x.id === selected)
  const selectedStep = form.steps[selectedIndex]
  const current = selectedStep || selected === 'end' ? selected : 'trigger'
  const dirty = JSON.stringify(form) !== saved
  // Basket triggers fire once the basket has been quiet this long, so steps count from there.
  const triggerDelay = TRIGGER_HAS_CART[trigger] ? (form.settings.afterMinutes ?? 60) : 0
  const s = automation.stats
  const tiles = [
    { label: copy.tiles.runs, value: formatNumber(s.runs) },
    { label: copy.tiles.active, value: formatNumber(s.active) },
    { label: copy.tiles.sent, value: formatNumber(s.sent) },
    { label: copy.tiles.clicked, value: campaignReportContent.rate(s.clicked, s.sent) },
    { label: copy.tiles.converted, value: formatNumber(s.converted) },
    { label: copy.tiles.sales, value: formatPaise(s.revenuePaise) },
  ]

  return (
    <div className="flex w-full flex-col gap-4 px-4 py-4 md:px-6">
      <SaveBar
        open={dirty}
        message={copy.saveBar.message}
        saveLabel={copy.saveBar.save}
        discardLabel={copy.saveBar.discard}
        onSave={handleSave}
        onDiscard={() => setForm(JSON.parse(saved) as Form)}
        saving={busy}
      />
      <header className="flex flex-wrap items-center gap-3">
        <nav className="flex min-w-0 flex-1 items-center gap-2 text-body">
          <Link
            href={routes.growth.automations()}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeftIcon className="size-4" aria-hidden="true" />
            {copy.breadcrumb}
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="truncate font-medium text-ink-strong">{form.name}</span>
          <StatusChip tone={active ? 'success' : 'neutral'} variant="dot">
            {active ? copy.on : copy.off}
          </StatusChip>
        </nav>
        <PillTabs
          variant="underline"
          value={tab}
          onChange={setTab}
          tabs={[
            { value: 'builder', label: copy.tabs.builder },
            { value: 'results', label: copy.tabs.results },
          ]}
        />
        <div className="flex flex-1 items-center justify-end gap-2">
          <Switch
            id="automation-on"
            checked={active}
            onCheckedChange={handleToggle}
            aria-label={active ? copy.on : copy.off}
          />
          <Button
            variant="outline"
            onClick={() => {
              setTesting(!testing)
              setTab('builder')
            }}
          >
            {testing ? <X /> : <ArrowRight />}
            {testing ? copy.stopTest : copy.testRun}
          </Button>
          <Button onClick={handleSave} disabled={busy || !dirty}>
            {copy.saveBar.save}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setConfirmDelete(true)}
            aria-label={copy.delete.action}
          >
            <Trash2 />
          </Button>
        </div>
      </header>
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {tab === 'builder' ? (
        <div className="grid min-h-[40rem] grid-cols-1 overflow-hidden rounded-xl border border-border bg-card lg:h-[calc(100dvh-10rem)] lg:grid-cols-[15rem_minmax(0,1fr)_22rem]">
          <AutomationPalette
            trigger={trigger}
            onAdd={(type) => handleInsert(type, form.steps.length)}
          />
          <AutomationFlow
            trigger={trigger}
            steps={form.steps}
            selected={current}
            onSelect={setSelected}
            onInsert={handleInsert}
            onReorder={setSteps}
          />
          <aside className="flex min-w-0 flex-col gap-3 overflow-y-auto border-border border-t p-4 lg:border-t-0 lg:border-l">
            {testing ? (
              <AutomationTestPanel steps={form.steps} />
            ) : selectedStep ? (
              <>
                <h2 className="text-eyebrow text-muted-foreground">{copy.flow.settings}</h2>
                <AutomationStepCard
                  key={selectedStep.id}
                  step={selectedStep}
                  offsetMinutes={triggerDelay + minutesBefore(form.steps, selectedIndex)}
                  hasCart={TRIGGER_HAS_CART[trigger]}
                  templates={templates}
                  storeName={storeName}
                  storefrontUrl={storefrontUrl}
                  onChange={(next) =>
                    setSteps(form.steps.map((x) => (x.id === selectedStep.id ? next : x)))
                  }
                  onRemove={() => {
                    setSteps(form.steps.filter((x) => x.id !== selectedStep.id))
                    setSelected('trigger')
                  }}
                />
              </>
            ) : selected === 'end' ? (
              <>
                <h2 className="text-card-title text-ink-strong">{copy.flow.ends}</h2>
                <p className="text-body text-muted-foreground">{copy.flow.endHelp}</p>
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel htmlFor="automation-name">{copy.name}</FieldLabel>
                  <Input
                    id="automation-name"
                    value={form.name}
                    maxLength={120}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </Field>
                <AutomationTriggerCard
                  trigger={trigger}
                  settings={form.settings}
                  onChange={(settings) => setForm((f) => ({ ...f, settings }))}
                />
              </>
            )}
          </aside>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
            {tiles.map((t) => (
              <Card key={t.label} gap="none" inset={4}>
                <p className="text-card-title">{t.label}</p>
                <p className="mt-2 text-stat text-ink-strong tabular-nums">{t.value}</p>
              </Card>
            ))}
          </div>
          <p className="text-caption text-muted-foreground">{copy.convertedHelp}</p>
          <AutomationRunsCard runs={automation.runs} stepCount={form.steps.length} />
        </>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={copy.delete.title}
        body={copy.delete.body}
        confirmLabel={copy.delete.confirm}
        cancelLabel={copy.delete.cancel}
        busy={busy}
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
