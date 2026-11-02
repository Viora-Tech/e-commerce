'use client'

import type {
  CatalogueView,
  TestRunResult,
  TestStep,
  WorkflowDefinition,
} from '@commerce/core/automations'
import { CircleAlert, CircleCheck, CircleDashed, Clock, ShieldCheck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogDescription, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { useState } from 'react'
import DialogContent from '@/components/layout/dialog-content'
import DialogHeader from '@/components/layout/dialog-header'
import { automationEditorContent, automationPiecesContent } from '@/data/automations'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { automationApi } from '@/lib/automation-api'
import { nodeView } from '@/lib/automation-node-view'
import type { RecordKind, RecordOption } from '@/lib/automation-records'
import RecordPickerDialog from '../record-picker-dialog'

type TestDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  workflowId: string
  def: WorkflowDefinition
  catalogue: CatalogueView
  /** Called after a test ran, so Publish stops suggesting one. */
  onTested: (result: TestRunResult) => void
}

const PICKABLE: readonly string[] = ['order', 'customer', 'product']

const STATUS_ICON: Record<TestStep['status'], typeof CircleCheck> = {
  // biome-ignore lint/suspicious/noThenProperty: a run status the engine calls "then"
  then: CircleCheck,
  otherwise: CircleDashed,
  would_run: CircleCheck,
  would_skip: CircleDashed,
  would_wait: Clock,
  would_ask: ShieldCheck,
  error: CircleAlert,
}

const STATUS_TONE: Record<TestStep['status'], string> = {
  // biome-ignore lint/suspicious/noThenProperty: a run status the engine calls "then"
  then: 'text-success',
  otherwise: 'text-muted-foreground',
  would_run: 'text-success',
  would_skip: 'text-muted-foreground',
  would_wait: 'text-muted-foreground',
  would_ask: 'text-warning-foreground dark:text-warning',
  error: 'text-danger',
}

/** Test with a record: pick a real order, customer or product and walk the draft; nothing changes. */
export default function TestDialog({
  open,
  onOpenChange,
  workflowId,
  def,
  catalogue,
  onTested,
}: TestDialogProps) {
  // Hooks
  const copy = useCopy(automationEditorContent)
  const pieces = useCopy(automationPiecesContent)
  const locale = useLocale()
  const [record, setRecord] = useState<RecordOption | null>(null)
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<TestRunResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Event handlers
  const handleRun = async () => {
    setBusy(true)
    setError(null)
    try {
      const next = await automationApi.testRun({
        id: workflowId,
        definition: def,
        subject: record && pickable ? { type: subject, id: record.id } : null,
      })
      setResult(next)
      onTested(next)
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : copy.test.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const t = copy.test
  const subject = catalogue.triggers.find((x) => x.id === def.trigger.type)?.subject ?? 'none'
  const pickable = PICKABLE.includes(subject)
  const what = t.subjects[subject] ?? subject

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.body}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {pickable ? (
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-body">
                {record ? (
                  <>
                    <span className="font-medium">{record.label}</span>
                    {record.detail ? (
                      <span className="text-muted-foreground"> · {record.detail}</span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">{t.pick(what)}</span>
                )}
              </span>
              <Button variant="outline" size="sm" onClick={() => setPicking(true)}>
                {record ? copy.fields.change : copy.fields.choose}
              </Button>
            </div>
          ) : (
            <p className="text-caption text-muted-foreground">{t.noSubject}</p>
          )}
          <Button
            className="self-start"
            disabled={busy || (pickable && !record)}
            onClick={() => void handleRun()}
          >
            {busy ? t.running : result ? t.again : t.run}
          </Button>
          {error ? <p className="text-body text-danger">{error}</p> : null}
          {result ? (
            <section aria-label={t.result} className="flex flex-col gap-3">
              <p className="text-eyebrow text-muted-foreground">{t.result}</p>
              {result.blocked ? (
                <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-body text-warning-foreground dark:text-warning">
                  {t.blocked} {result.blocked}
                </p>
              ) : null}
              <ol className="flex flex-col gap-3">
                {result.steps.map((step) => {
                  const node = def.nodes[step.nodeId]
                  const title = node
                    ? nodeView(node, { catalogue, pieces, locale, copy }).title
                    : step.nodeId
                  const Icon = STATUS_ICON[step.status]
                  return (
                    <li key={step.nodeId} className="flex items-start gap-2.5">
                      <Icon
                        className={cn('mt-0.5 size-4 shrink-0', STATUS_TONE[step.status])}
                        aria-hidden="true"
                      />
                      <div className="flex min-w-0 flex-col">
                        <span className="text-body font-medium text-foreground">
                          {title}{' '}
                          <span className="text-muted-foreground">· {t.statuses[step.status]}</span>
                        </span>
                        <span className="text-caption text-muted-foreground">{step.summary}</span>
                        {step.warnings.map((w) => (
                          <span
                            key={w}
                            className="text-caption text-warning-foreground dark:text-warning"
                          >
                            {w}
                          </span>
                        ))}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </section>
          ) : null}
        </div>
        {pickable ? (
          <RecordPickerDialog
            open={picking}
            kind={subject as RecordKind}
            title={t.pick(what)}
            placeholder={
              subject === 'order'
                ? t.searchOrders
                : subject === 'customer'
                  ? t.searchCustomers
                  : t.searchProducts
            }
            selected={record?.id ?? null}
            onClose={() => setPicking(false)}
            onPick={(o) => {
              setRecord(o)
              setResult(null)
              setPicking(false)
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
