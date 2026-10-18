'use client'

import { MEMBER_ALERTS, type MemberAlertPrefsInput } from '@commerce/core/member-account'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import { Label } from '@commerce/ui/shadcn/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { accountContent } from '@/data/account'
import { useCopy, useRegion } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type Loaded = Awaited<ReturnType<typeof api.account.notifications>>
type Form = MemberAlertPrefsInput
type Channel = 'email' | 'whatsapp'

/** Alerts the worker sends today; the rest are saved for when their senders land. */
const WIRED: ReadonlySet<string> = new Set(['newOrder', 'dailySummary'])
const HOURS = Array.from({ length: 24 }, (_, h) => h)

/** The saved prefs as the form edits them (`lastSentOn` is the server's). */
function formOf(prefs: Loaded['prefs']): Form {
  const { lastSentOn: _sent, ...dailySummary } = prefs.dailySummary
  return { ...prefs, dailySummary }
}

/**
 * Account → Notifications: the member's own alerts for the store they are in, by email and
 * (when the store has it) WhatsApp, and the hour of their daily summary. Save bar like Profile.
 */
export default function NotificationsPage() {
  // Hooks
  const { notifications: copy } = useCopy(accountContent)
  const region = useRegion()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [failed, setFailed] = useState(false)
  const [version, setVersion] = useState(0)
  const [saving, setSaving] = useState(false)
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-runs the load after Try again
  useEffect(() => {
    api.account
      .notifications()
      .then((r) => {
        setLoaded(r)
        setForm(formOf(r.prefs))
      })
      .catch(() => setFailed(true))
  }, [version])

  // Helpers
  const hourLabel = (hour: number) =>
    region.clock === '24h' ? `${String(hour).padStart(2, '0')}:00` : copy.hourLabel(hour)

  // Event handlers
  const handleSwitch = (alert: (typeof MEMBER_ALERTS)[number], channel: Channel, on: boolean) =>
    setForm((f) => (f ? { ...f, [alert]: { ...f[alert], [channel]: on } } : f))

  const handleHour = (value: string | null) =>
    setForm((f) =>
      f && value !== null ? { ...f, dailySummary: { ...f.dailySummary, hour: Number(value) } } : f,
    )

  const handleSave = async () => {
    if (!form || !loaded) return
    setSaving(true)
    try {
      const prefs = await api.account.updateNotifications(form)
      setLoaded({ ...loaded, prefs })
      setForm(formOf(prefs))
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  const handleDiscard = () => {
    if (loaded) setForm(formOf(loaded.prefs))
  }

  const handleRetry = () => {
    setFailed(false)
    setVersion((n) => n + 1)
  }

  // Early returns
  if (failed) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title={copy.title} />
        <Card gap={3} inset={6} className="items-start">
          <p className="text-body text-muted-foreground">{copy.loadFailed}</p>
          <Button variant="outline" onClick={handleRetry}>
            {copy.retry}
          </Button>
        </Card>
      </div>
    )
  }

  // Render logic
  const dirty =
    loaded !== null &&
    form !== null &&
    JSON.stringify(form) !== JSON.stringify(formOf(loaded.prefs))
  const channels: Channel[] = loaded?.whatsappAvailable ? ['email', 'whatsapp'] : ['email']
  const hourItems = Object.fromEntries(HOURS.map((h) => [String(h), hourLabel(h)]))

  return (
    <div className="flex flex-col gap-4">
      <SaveBar
        open={dirty}
        message={copy.unsaved}
        saveLabel={copy.save}
        discardLabel={copy.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={saving}
      />
      <PageHeader
        title={copy.title}
        subtitle={loaded ? copy.intro(loaded.storeName) : undefined}
        save={{ dirty, saving, onSave: handleSave, label: copy.save }}
      />
      <SettingsCard title={copy.heading} description={copy.body}>
        {!loaded || !form ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ul className="flex flex-col">
            {MEMBER_ALERTS.map((alert) => (
              <li
                key={alert}
                className="flex flex-col gap-3 border-b border-hairline py-4 first:pt-0 last:border-b-0 last:pb-0 md:flex-row md:items-center md:gap-6"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-body font-semibold text-ink-strong">
                      {copy.alerts[alert].label}
                    </span>
                    {WIRED.has(alert) ? null : <StatusChip>{copy.soonBadge}</StatusChip>}
                  </div>
                  <span className="text-caption text-muted-foreground">
                    {copy.alerts[alert].help}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {alert === 'dailySummary' ? (
                    <div className="flex items-center gap-2 text-body text-muted-foreground">
                      <span aria-hidden="true">{copy.summaryTime}</span>
                      <Select
                        items={hourItems}
                        value={String(form.dailySummary.hour)}
                        onValueChange={handleHour}
                      >
                        <SelectTrigger className="w-28" aria-label={copy.summaryTime}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {HOURS.map((h) => (
                            <SelectItem key={h} value={String(h)}>
                              {hourLabel(h)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  {channels.map((channel) => (
                    <Label
                      key={channel}
                      htmlFor={`alert-${alert}-${channel}`}
                      className="flex items-center gap-2 text-body font-normal text-ink-strong"
                    >
                      <Switch
                        id={`alert-${alert}-${channel}`}
                        checked={form[alert][channel]}
                        onCheckedChange={(on) => handleSwitch(alert, channel, on)}
                        disabled={channel === 'whatsapp' && !loaded.hasPhone}
                      />
                      {copy.channels[channel]}
                    </Label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
      {loaded ? (
        <div className="flex flex-col gap-1 px-1 text-caption text-muted-foreground">
          {loaded.whatsappAvailable ? (
            loaded.hasPhone ? null : (
              <p>
                {copy.needPhone}{' '}
                <Link href={routes.account.home()} className="text-primary hover:underline">
                  {copy.addPhone}
                </Link>
              </p>
            )
          ) : (
            <p>{copy.whatsappOff}</p>
          )}
          <p>{copy.soon}</p>
          <p>{copy.storeWide}</p>
        </div>
      ) : null}
    </div>
  )
}
