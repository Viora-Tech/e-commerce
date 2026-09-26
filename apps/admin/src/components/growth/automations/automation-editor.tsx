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
import { CircleAlert, Plus, Trash2 } from '@commerce/ui/icons'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { blockId } from '@/components/growth/campaigns/form-state'
import type { TemplatesResult } from '@/components/growth/campaigns/whatsapp-template-card'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import { automationEditorContent as copy } from '@/data/marketing-automations'
import { campaignReportContent } from '@/data/marketing-campaigns'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'
import AutomationRunsCard from './automation-runs-card'
import AutomationStepCard from './automation-step-card'
import AutomationTriggerCard from './automation-trigger-card'
import DeleteAutomationDialog from './delete-automation-dialog'

type Loaded = NonNullable<Awaited<ReturnType<typeof api.marketing.automations.get>>>

type AutomationEditorProps = {
  automation: Loaded
  storeName: string
  storefrontUrl: string
}

type Form = { name: string; steps: AutomationStep[]; settings: AutomationSettings }

const STEP_TYPES: AutomationStepType[] = ['wait', 'email', 'whatsapp', 'condition']

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

  useEffect(() => {
    if (!form.steps.some((s) => s.type === 'whatsapp') || templates) return
    api.marketing.campaigns.whatsappTemplates().then(setTemplates)
  }, [form.steps, templates])

  // Helpers
  const setSteps = (steps: AutomationStep[]) => setForm((f) => ({ ...f, steps }))

  // Event handlers
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
    router.push('/growth/automations')
    router.refresh()
  }

  const handleMove = (index: number, delta: number) => {
    const to = index + delta
    if (to < 0 || to >= form.steps.length) return
    const next = [...form.steps]
    const [moved] = next.splice(index, 1)
    if (moved) next.splice(to, 0, moved)
    setSteps(next)
  }

  // Render logic
  const trigger = automation.trigger as AutomationTrigger
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
    <PageBody width="wide">
      <SaveBar
        open={dirty}
        message={copy.saveBar.message}
        saveLabel={copy.saveBar.save}
        discardLabel={copy.saveBar.discard}
        onSave={handleSave}
        onDiscard={() => setForm(JSON.parse(saved) as Form)}
        saving={busy}
      />
      <PageHeader
        title={form.name}
        breadcrumbs={[
          { label: copy.breadcrumb, href: '/growth/automations' },
          { label: form.name },
        ]}
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-body" htmlFor="automation-on">
              <Switch id="automation-on" checked={active} onCheckedChange={handleToggle} />
              {active ? copy.on : copy.off}
            </label>
            <Button
              variant="ghost"
              onClick={() => setConfirmDelete(true)}
              aria-label={copy.delete.action}
            >
              <Trash2 />
            </Button>
          </div>
        }
      />
      {error ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Card key={t.label} className="gap-0 p-4">
            <p className="text-card-title">{t.label}</p>
            <p className="mt-2 text-stat text-ink-strong tabular-nums">{t.value}</p>
          </Card>
        ))}
      </div>
      <p className="text-caption text-muted-foreground">{copy.convertedHelp}</p>
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <Card className="p-4">
            <Field>
              <FieldLabel htmlFor="automation-name">{copy.name}</FieldLabel>
              <Input
                id="automation-name"
                value={form.name}
                maxLength={120}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </Field>
          </Card>
          <AutomationTriggerCard
            trigger={trigger}
            settings={form.settings}
            onChange={(settings) => setForm((f) => ({ ...f, settings }))}
          />
          <div className="flex items-center justify-between">
            <h2 className="text-kit-title text-foreground">{copy.steps.title}</h2>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
                <Plus />
                {copy.steps.add}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                {STEP_TYPES.map((t) => (
                  <DropdownMenuItem
                    key={t}
                    onClick={() => setSteps([...form.steps, newStep(t)])}
                    className="flex-col items-start gap-0"
                  >
                    <span className="font-medium">{copy.steps.types[t]}</span>
                    <span className="text-caption text-muted-foreground">
                      {copy.steps.hints[t]}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {form.steps.length === 0 ? (
            <p className="text-body text-muted-foreground">{copy.steps.empty}</p>
          ) : null}
          {form.steps.map((step, i) => (
            <AutomationStepCard
              key={step.id}
              step={step}
              index={i}
              count={form.steps.length}
              offsetMinutes={triggerDelay + minutesBefore(form.steps, i)}
              hasCart={TRIGGER_HAS_CART[trigger]}
              templates={templates}
              storeName={storeName}
              storefrontUrl={storefrontUrl}
              onChange={(next) => setSteps(form.steps.map((x) => (x.id === step.id ? next : x)))}
              onMove={(delta) => handleMove(i, delta)}
              onRemove={() => setSteps(form.steps.filter((x) => x.id !== step.id))}
            />
          ))}
        </div>
        <AutomationRunsCard runs={automation.runs} stepCount={form.steps.length} />
      </div>
      <DeleteAutomationDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        busy={busy}
        onConfirm={handleDelete}
      />
    </PageBody>
  )
}
