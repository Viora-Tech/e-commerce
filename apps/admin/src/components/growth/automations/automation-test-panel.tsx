'use client'

import type { AutomationStep } from '@commerce/core/marketing'
import { CircleCheck, CircleDashed, RefreshCw } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useState } from 'react'
import { automationEditorContent, durationLabel } from '@/data/marketing-automations'
import { useCopy } from '@/hooks/use-copy'
import { runTest, TEST_SHOPPERS, type TestEvent } from '@/lib/automation-test-run'
import { formatPaise } from '@/lib/money'

type AutomationTestPanelProps = {
  steps: AutomationStep[]
}

/** Figma "Automation builder — Test run": walks a made-up shopper through the flow, sending nothing. */
export default function AutomationTestPanel({ steps }: AutomationTestPanelProps) {
  // Hooks
  const { test: copy } = useCopy(automationEditorContent)
  const [shopperId, setShopperId] = useState(TEST_SHOPPERS[0]?.id ?? '')
  const [round, setRound] = useState(0)

  // Helpers
  const line = (e: TestEvent): { title: string; detail: string; ok: boolean } => {
    if (e.kind === 'trigger') {
      return {
        title: copy.events.trigger,
        detail: copy.basketLine(formatPaise(shopper?.cartValuePaise ?? 0)),
        ok: true,
      }
    }
    if (e.kind === 'wait') {
      return { title: copy.events.wait(durationLabel(e.minutes)), detail: copy.skipped, ok: true }
    }
    if (e.kind === 'whatsapp') {
      return e.skipped
        ? { title: copy.events.whatsappSkipped, detail: copy.noConsent, ok: false }
        : { title: copy.events.whatsapp, detail: e.template || copy.noTemplate, ok: true }
    }
    if (e.kind === 'email') {
      return e.skipped
        ? { title: copy.events.emailSkipped, detail: copy.noConsent, ok: false }
        : { title: copy.events.email, detail: e.subject || copy.noSubject, ok: true }
    }
    if (e.kind === 'condition') {
      return e.passed
        ? { title: copy.events.passed, detail: copy.passedDetail, ok: true }
        : { title: copy.events.failed, detail: copy.failedDetail, ok: false }
    }
    return { title: copy.events.end, detail: copy.endDetail, ok: true }
  }

  // Render logic
  const shopper = TEST_SHOPPERS.find((s) => s.id === shopperId) ?? TEST_SHOPPERS[0]
  if (!shopper) return null
  const run = runTest(steps, shopper)

  return (
    <div key={round} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-eyebrow text-muted-foreground">{copy.eyebrow}</p>
        <h2 className="text-card-title text-ink-strong">{copy.shopper}</h2>
        <p className="text-caption text-muted-foreground">{copy.intro}</p>
      </div>
      <div className="flex items-center gap-2">
        <Select value={shopperId} onValueChange={(v) => v && setShopperId(v)}>
          <SelectTrigger className="flex-1" aria-label={copy.basket}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TEST_SHOPPERS.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {copy.shopperLabel(formatPaise(s.cartValuePaise), s.items, s.acceptsMarketing)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setRound(round + 1)}>
          <RefreshCw />
          {copy.again}
        </Button>
      </div>
      <p
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-2 text-body',
          run.reachedEnd
            ? 'border-success/30 bg-success-soft text-success'
            : 'border-warning/30 bg-warning-soft text-warning-foreground dark:text-warning',
        )}
      >
        <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
        {run.reachedEnd
          ? copy.reachedEnd(run.events.length, run.messages)
          : copy.stopped(run.events.length, run.messages)}
      </p>
      <ol className="flex flex-col gap-3">
        {run.events.map((e, i) => {
          const l = line(e)
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: events are a fixed replay of the flow
            <li key={i} className="flex items-start gap-2.5">
              {l.ok ? (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <CircleDashed
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              <div className="flex min-w-0 flex-col">
                <span className="text-body font-medium text-foreground">{l.title}</span>
                <span className="text-caption text-muted-foreground">{l.detail}</span>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
