'use client'

import { INBOX_CONTACT_CAPTURE, type InboxSettings } from '@commerce/core/inbox'
import { permissions } from '@commerce/core/permissions'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import SettingsCard from '@/components/settings/settings-card'
import SettingsRow from '@/components/settings/settings-row'
import { inboxContent } from '@/data/inbox'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import BlockedSenders from './blocked-senders'
import HoursEditor from './hours-editor'

type SettingsPageProps = {
  settings: InboxSettings
  timeZone: string
}

const AVAILABILITY = ['always', 'hours', 'offline'] as const

/** A whole number from a field, kept inside `min`..`max`; the old value when it does not parse. */
function wholeNumber(raw: string, min: number, max: number, fallback: number): number {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

/**
 * Sales channels › Inbox › Settings: the chat button and greeting, business hours and the away
 * message, what is asked of guests, the unanswered email, retention, and blocked senders.
 */
export default function SettingsPage({ settings, timeZone }: SettingsPageProps) {
  // Hooks
  const copy = useCopy(inboxContent)
  const { hasPermission } = usePermissions()
  const [saved, setSaved] = useState(settings)
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)

  // Helpers
  const patch = (next: Partial<InboxSettings>) => setForm((f) => ({ ...f, ...next }))

  // Event handlers
  const handleSave = async () => {
    setSaving(true)
    try {
      const next = await api.inbox.settings.save(form)
      setSaved(next)
      setForm(next)
      toast.success(copy.settings.saved)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const s = copy.settings
  const canManage = hasPermission(permissions.INBOX_MANAGE)
  const dirty = JSON.stringify(form) !== JSON.stringify(saved)

  return (
    <div className="flex flex-col gap-5">
      <SaveBar
        open={dirty && canManage}
        message={s.unsaved}
        saveLabel={s.save}
        discardLabel={s.discard}
        onSave={handleSave}
        onDiscard={() => setForm(saved)}
        saving={saving}
      />
      <PageHeader title={s.title} summary={s.subtitle} />
      <fieldset disabled={!canManage} className="flex min-w-0 flex-col gap-5">
        <SettingsCard title={s.chat.title}>
          <SettingsRow
            label={s.chat.greeting.label}
            description={s.chat.greeting.help}
            htmlFor="inbox-greeting"
          >
            <Textarea
              id="inbox-greeting"
              rows={2}
              maxLength={300}
              placeholder={s.chat.greeting.placeholder}
              value={form.greeting}
              onChange={(e) => patch({ greeting: e.target.value })}
            />
          </SettingsRow>
          <SettingsRow
            label={s.chat.sound.label}
            description={s.chat.sound.help}
            htmlFor="inbox-sound"
          >
            <Switch
              id="inbox-sound"
              checked={form.sound}
              onCheckedChange={(sound) => patch({ sound })}
            />
          </SettingsRow>
        </SettingsCard>

        <SettingsCard title={s.availability.title} description={s.availability.help(timeZone)}>
          <SettingsRow label={s.availability.label} htmlFor="inbox-availability">
            <NativeSelect
              id="inbox-availability"
              value={form.availability}
              onChange={(e) =>
                patch({
                  availability: AVAILABILITY.find((a) => a === e.target.value) ?? 'always',
                })
              }
            >
              {AVAILABILITY.map((a) => (
                <NativeSelectOption key={a} value={a}>
                  {s.availability.options[a]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </SettingsRow>
          {form.availability === 'hours' ? (
            <SettingsRow label={s.availability.hours}>
              <HoursEditor hours={form.hours} onChange={(hours) => patch({ hours })} />
            </SettingsRow>
          ) : null}
          <SettingsRow
            label={s.availability.away.label}
            description={s.availability.away.help}
            htmlFor="inbox-away"
          >
            <Textarea
              id="inbox-away"
              rows={2}
              maxLength={300}
              placeholder={s.availability.away.placeholder}
              value={form.awayMessage}
              onChange={(e) => patch({ awayMessage: e.target.value })}
            />
          </SettingsRow>
        </SettingsCard>

        <SettingsCard title={s.contact.title}>
          <SettingsRow
            label={s.contact.capture.label}
            description={s.contact.capture.help}
            htmlFor="inbox-capture"
          >
            <NativeSelect
              id="inbox-capture"
              value={form.contactCapture}
              onChange={(e) =>
                patch({
                  contactCapture:
                    INBOX_CONTACT_CAPTURE.find((c) => c === e.target.value) ?? 'optional',
                })
              }
            >
              {INBOX_CONTACT_CAPTURE.map((c) => (
                <NativeSelectOption key={c} value={c}>
                  {s.contact.capture.options[c]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </SettingsRow>
          <SettingsRow
            label={s.contact.signIn.label}
            description={s.contact.signIn.help}
            htmlFor="inbox-sign-in"
          >
            <Switch
              id="inbox-sign-in"
              checked={form.requireSignIn}
              onCheckedChange={(requireSignIn) => patch({ requireSignIn })}
            />
          </SettingsRow>
        </SettingsCard>

        <SettingsCard title={s.email.title}>
          <SettingsRow
            label={s.email.fallback.label}
            description={s.email.fallback.help}
            htmlFor="inbox-fallback"
          >
            <div className="flex items-center gap-2">
              <Input
                id="inbox-fallback"
                inputMode="numeric"
                className="w-24"
                value={String(form.emailFallbackMinutes)}
                onChange={(e) =>
                  patch({
                    emailFallbackMinutes: wholeNumber(
                      e.target.value,
                      0,
                      240,
                      form.emailFallbackMinutes,
                    ),
                  })
                }
              />
              <span className="text-body text-muted-foreground">{s.email.fallback.suffix}</span>
            </div>
          </SettingsRow>
        </SettingsCard>

        <SettingsCard title={s.privacy.title}>
          <SettingsRow
            label={s.privacy.retention.label}
            description={s.privacy.retention.help}
            htmlFor="inbox-retention"
          >
            <div className="flex items-center gap-2">
              <Input
                id="inbox-retention"
                inputMode="numeric"
                className="w-24"
                value={String(form.retentionMonths)}
                onChange={(e) =>
                  patch({
                    retentionMonths: wholeNumber(e.target.value, 3, 60, form.retentionMonths),
                  })
                }
              />
              <span className="text-body text-muted-foreground">{s.privacy.retention.suffix}</span>
            </div>
          </SettingsRow>
        </SettingsCard>
      </fieldset>
      <BlockedSenders />
    </div>
  )
}
