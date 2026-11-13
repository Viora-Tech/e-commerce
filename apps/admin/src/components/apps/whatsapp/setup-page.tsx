'use client'

import { permissions } from '@commerce/core/permissions'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { whatsappAppContent } from '@/data/whatsapp-app'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import SetupStepRow from './setup-step-row'
import ShoppersPreviewCard from './shoppers-preview-card'

type Setup = Awaited<ReturnType<typeof api.platformApps.whatsappSetup>>
type Templates = Awaited<ReturnType<typeof api.platformApps.whatsappTemplates>>
type SubmitResults = Awaited<ReturnType<typeof api.platformApps.submitWhatsappTemplates>>

const STEP_KEYS = ['number', 'meta', 'templates'] as const

type TemplatesStep = 'done' | 'pending' | 'rejected' | 'todo' | 'unknown'

/** Step 3 from Meta's statuses of the three order templates. */
function templatesStep(setup: Setup, templates: Templates | null): TemplatesStep {
  if (!templates?.statusKnown) return setup.access === 'live' ? 'todo' : 'unknown'
  const states = setup.required.map(
    (id) => templates.templates.find((t) => t.id === id)?.status ?? 'not_submitted',
  )
  if (states.every((s) => s === 'approved')) return 'done'
  if (states.includes('rejected')) return 'rejected'
  if (states.every((s) => s === 'approved' || s === 'pending')) return 'pending'
  return 'todo'
}

/**
 * Apps → WhatsApp → Setup (Figma 928:11726 "WhatsApp · Needs setup"): the three steps with a
 * progress bar, each read from the saved connection and Meta's template statuses, and the
 * order messages shoppers will get.
 */
export default function WhatsappSetupPage() {
  // Hooks
  const copy = useCopy(whatsappAppContent)
  const { hasPermission } = usePermissions()
  const [setup, setSetup] = useState<Setup | null>(null)
  const [templates, setTemplates] = useState<Templates | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let live = true
    api.platformApps
      .whatsappSetup()
      .then((r) => live && setSetup(r))
      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : String(err)))
    api.platformApps
      .whatsappTemplates()
      .then((r) => live && setTemplates(r))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  // Helpers
  const reportSubmit = (results: SubmitResults) => {
    const failed = results.filter((r) => !r.ok)
    const sent = results.length - failed.length
    if (sent) toast.success(copy.submit.sent(sent))
    for (const r of failed) if (!r.ok) toast.error(copy.submit.failed(r.id, r.error))
  }

  const stateLabel = (d: boolean) => (d ? copy.setup.stepDone : copy.setup.stepTodo)
  const linkButton = (href: string, label: string) => (
    <Button variant="outline" size="sm" nativeButton={false} render={<Link href={href} />}>
      {label}
    </Button>
  )

  // Event handlers
  const handleSubmit = async () => {
    if (!setup) return
    setSubmitting(true)
    try {
      reportSubmit(await api.platformApps.submitWhatsappTemplates({ ids: [...setup.required] }))
      setTemplates(await api.platformApps.whatsappTemplates())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.submit.error)
    } finally {
      setSubmitting(false)
    }
  }

  // Early returns
  if (!setup) {
    return (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-11 w-80" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Render logic
  const words = copy.setup
  const step3 = templatesStep(setup, templates)
  const steps = [Boolean(setup.number), setup.connected, step3 === 'done']
  const done = steps.filter(Boolean).length
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const settingsHref = routes.apps.page('whatsapp', 'settings')
  const templatesHref = routes.apps.page('whatsapp', 'templates')
  const numberLabel = setup.number?.label
  const numberDetail = !setup.number
    ? words.number.todo
    : !numberLabel
      ? words.number.savedNoName
      : setup.number.verified
        ? words.number.verified(numberLabel)
        : words.number.saved(numberLabel)
  const templatesDetail = {
    done: words.templates.done,
    pending: words.templates.pending,
    rejected: words.templates.rejected,
    todo: words.templates.todo,
    unknown: setup.connected ? words.templates.unknown : words.templates.todo,
  }[step3]
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-[1.125rem] leading-6 font-semibold text-ink-strong">
          {done === steps.length ? words.doneTitle : words.title}
        </h2>
        <p className="text-caption text-muted-foreground">
          {done === steps.length ? words.doneIntro : words.intro}
        </p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_22.5rem]">
        <section className="overflow-hidden rounded-xl border border-panel-border bg-card">
          <div className="flex flex-col gap-0.5 px-4 pt-3.5 pb-3">
            <h3 className="text-body font-semibold text-ink-strong">{words.card}</h3>
            <p className="text-caption text-muted-foreground">
              {words.progress(done, steps.length)}
            </p>
          </div>
          <div className="flex gap-1 px-4 pb-3" aria-hidden="true">
            {steps.map((d, i) => (
              <span
                key={STEP_KEYS[i]}
                className={cn('h-1 flex-1 rounded-full', d ? 'bg-success' : 'bg-muted')}
              />
            ))}
          </div>
          <ol>
            <SetupStepRow
              title={words.number.title}
              detail={numberDetail}
              done={steps[0] ?? false}
              stateLabel={stateLabel(steps[0] ?? false)}
              action={setup.number ? undefined : linkButton(settingsHref, words.number.action)}
            />
            <SetupStepRow
              title={words.meta.title}
              detail={
                setup.connected
                  ? setup.testMode
                    ? words.meta.testMode
                    : words.meta.done
                  : words.meta.todo
              }
              done={setup.connected}
              stateLabel={stateLabel(setup.connected)}
              action={setup.connected ? undefined : linkButton(settingsHref, words.meta.action)}
            />
            <SetupStepRow
              title={words.templates.title}
              detail={templatesDetail}
              done={step3 === 'done'}
              stateLabel={stateLabel(step3 === 'done')}
              action={
                step3 === 'todo' && setup.access === 'live' && canManage ? (
                  <Button variant="outline" size="sm" onClick={handleSubmit} disabled={submitting}>
                    {submitting ? <Spinner /> : null}
                    {submitting ? words.templates.submitting : words.templates.action}
                  </Button>
                ) : step3 === 'done' ? undefined : (
                  linkButton(templatesHref, words.templates.manual)
                )
              }
            />
          </ol>
        </section>
        <ShoppersPreviewCard
          title={words.previewTitle}
          help={words.previewHelp}
          messages={setup.previews.map((p) => p.text)}
        />
      </div>
    </div>
  )
}
