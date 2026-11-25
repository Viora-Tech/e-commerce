'use client'

import { LOYALTY_EMAIL_KEYS, type LoyaltySettings, loyaltyEmailOn } from '@commerce/core/loyalty'
import { Button } from '@commerce/ui/shadcn/button'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import DataCardSkeleton from '@/components/layout/data-card-skeleton'
import NoticeBar from '@/components/layout/notice-bar'
import PageHeader from '@/components/layout/page-header'
import { loyaltyInsightsContent } from '@/data/loyalty-insights'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'

/** Templates the worker sends today; the others wait in the queue until their design exists. */
const SENT_NOW = new Set(['points_expiring'])

/** `points_expiring:30` → `points_expiring`. */
const templateOf = (key: string) => key.split(':')[0] ?? key

/**
 * The loyalty emails with an on/off switch each (stored as the app's `emailsOff`), how many
 * wait and went, and a pointer to Notifications for their design.
 */
export default function LoyaltyEmailsPage() {
  // Hooks
  const copy = useCopy(loyaltyInsightsContent)
  const f = useFormat()
  const { data, failed, retry, setData } = useLoad(async () => {
    const [settings, counts] = await Promise.all([api.loyalty.settings.get(), api.loyalty.emails()])
    return { settings, counts }
  }, [])
  const [saving, setSaving] = useState<string | null>(null)

  // Event handlers
  const handleSwitch = async (key: string, on: boolean) => {
    if (!data) return
    const current: LoyaltySettings = data.settings
    const rest = current.emailsOff.filter((k) => k !== key)
    const next: LoyaltySettings = {
      ...current,
      emailsOff: on ? rest : [...rest, key],
      // Switching an expiry reminder back on undoes the v1 "0 days" off switch.
      reminderDays:
        on && key.startsWith('points_expiring') && current.reminderDays === 0
          ? 14
          : current.reminderDays,
    }
    setSaving(key)
    try {
      const saved = await api.loyalty.settings.save(next)
      setData((prev) => (prev ? { ...prev, settings: saved } : prev))
    } catch (err) {
      toast.error(errorText(err, copy.emails.failed))
    } finally {
      setSaving(null)
    }
  }

  // Render logic
  const e = copy.emails
  const header = <PageHeader title={e.title} summary={e.summary} />
  const note = (
    <NoticeBar
      action={
        <Button
          size="sm"
          variant="outline"
          nativeButton={false}
          render={<Link href={routes.settings.notifications()} />}
        >
          {e.designLink}
        </Button>
      }
    >
      {e.designNote}
    </NoticeBar>
  )

  return (
    // Essential Loyalty's column: about 50rem, centred (tables stay full width).
    <div className="mx-auto flex w-full max-w-[50rem] flex-col gap-5">
      {header}
      {note}
      {failed ? (
        <LoadFailedState size="page" heading={e.loadFailed} failed={failed} onRetry={retry} />
      ) : !data ? (
        <DataCardSkeleton fields={0} lines={8} />
      ) : (
        <DataCard flush>
          <ul className="divide-y divide-border">
            {LOYALTY_EMAIL_KEYS.map((key) => {
              const item = e.items[key]
              const template = templateOf(key)
              const counts = data.counts.find((c) => c.template === template)
              const showCounts = !key.includes(':') || key.endsWith(':30')
              const on = loyaltyEmailOn(data.settings, key)
              const remindersOff =
                template === 'points_expiring' && data.settings.reminderDays === 0
              return (
                <li key={key} className="flex items-start gap-4 px-4 py-3">
                  <div className="flex flex-1 flex-col gap-0.5">
                    <label htmlFor={`loyalty-email-${key}`} className="text-body font-medium">
                      {item?.title ?? key}
                    </label>
                    <p className="text-caption text-muted-foreground">{item?.body}</p>
                    {remindersOff ? (
                      <p className="text-caption text-muted-foreground">{e.remindersOff}</p>
                    ) : null}
                    {SENT_NOW.has(template) ? null : (
                      <p className="text-caption text-muted-foreground">{e.notReady}</p>
                    )}
                    {showCounts && counts ? (
                      <p className="text-caption text-muted-foreground tabular-nums">
                        {e.sent(f.number(counts.sent))} · {e.waiting(f.number(counts.waiting))}
                      </p>
                    ) : null}
                  </div>
                  <Switch
                    id={`loyalty-email-${key}`}
                    checked={on}
                    disabled={saving !== null}
                    aria-label={on ? e.on : e.off}
                    onCheckedChange={(next) => handleSwitch(key, next)}
                  />
                </li>
              )
            })}
          </ul>
        </DataCard>
      )}
    </div>
  )
}
