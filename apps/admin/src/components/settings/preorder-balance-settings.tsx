'use client'

import type { PreorderStoreSettings, UnpaidBalanceAction } from '@commerce/core/preorder'
import { Save } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { paymentsSettingsContent } from '@/data/payments'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import SettingsCard from './settings-card'

const ACTIONS: UnpaidBalanceAction[] = ['none', 'cancel_refund', 'cancel_keep']

const DEFAULT_AUTO_DAYS = 7

const toDays = (raw: string, min: number): number => {
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) ? Math.min(Math.max(n, min), 90) : min
}

/** "3, 6" → [3, 6]: whole days 1-90, at most two. */
const parseReminders = (raw: string): number[] =>
  raw
    .split(',')
    .map((s) => Number.parseInt(s.trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 90)
    .slice(0, 2)

/** Settings › Payments › Pre-orders: balance request, reminders and the unpaid-balance rule. */
export default function PreorderBalanceSettings() {
  // Hooks
  const { preorder: copy } = useCopy(paymentsSettingsContent)
  const [form, setForm] = useState<PreorderStoreSettings | null>(null)
  const [reminders, setReminders] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    api.store
      .getPreorder()
      .then((s) => {
        setForm(s)
        setReminders(s.reminderDays.join(', '))
      })
      .catch(() => toast.error(copy.saveFailed))
  }, [copy.saveFailed])

  // Helpers
  const patch = (next: Partial<PreorderStoreSettings>) =>
    setForm((f) => (f ? { ...f, ...next } : f))

  // Event handlers
  const handleSave = async () => {
    if (!form) return
    setSaving(true)
    try {
      const saved = await api.store.updatePreorder({
        ...form,
        reminderDays: parseReminders(reminders),
      })
      setForm(saved)
      setReminders(saved.reminderDays.join(', '))
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.saveFailed)
    } finally {
      setSaving(false)
    }
  }

  // Early returns
  if (!form) return null

  // Render logic
  const auto = form.autoRequestDaysBeforeShip !== null

  return (
    <SettingsCard title={copy.heading} description={copy.intro}>
      <FieldGroup>
        <Field orientation="horizontal">
          <Switch
            id="preorder-auto-request"
            checked={auto}
            onCheckedChange={(on) =>
              patch({ autoRequestDaysBeforeShip: on ? DEFAULT_AUTO_DAYS : null })
            }
          />
          <FieldLabel htmlFor="preorder-auto-request">{copy.autoRequest}</FieldLabel>
        </Field>
        {auto ? (
          <Field>
            <FieldLabel htmlFor="preorder-auto-days">{copy.autoRequestDays}</FieldLabel>
            <Input
              size="lg"
              id="preorder-auto-days"
              type="number"
              min={0}
              max={90}
              value={String(form.autoRequestDaysBeforeShip ?? 0)}
              onChange={(e) => patch({ autoRequestDaysBeforeShip: toDays(e.target.value, 0) })}
            />
          </Field>
        ) : null}
        <FieldDescription>{copy.autoRequestHelp}</FieldDescription>

        <Field>
          <FieldLabel htmlFor="preorder-reminders">{copy.reminders}</FieldLabel>
          <Input
            size="lg"
            id="preorder-reminders"
            inputMode="numeric"
            value={reminders}
            onChange={(e) => setReminders(e.target.value)}
            autoComplete="off"
          />
          <FieldDescription>{copy.remindersHelp}</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>{copy.unpaid}</FieldLabel>
          <RadioGroup
            value={form.unpaidAction}
            onValueChange={(v) => patch({ unpaidAction: v as UnpaidBalanceAction })}
            className="flex flex-col gap-2"
          >
            {ACTIONS.map((a) => (
              <div key={a} className="flex items-center gap-2">
                <RadioGroupItem id={`preorder-unpaid-${a}`} value={a} />
                <label htmlFor={`preorder-unpaid-${a}`} className="text-body text-foreground">
                  {copy.actions[a]}
                </label>
              </div>
            ))}
          </RadioGroup>
          {form.unpaidAction === 'cancel_keep' ? (
            <FieldDescription>{copy.keepWarning}</FieldDescription>
          ) : null}
        </Field>
        {form.unpaidAction !== 'none' ? (
          <Field>
            <FieldLabel htmlFor="preorder-pay-within">{copy.payWithin}</FieldLabel>
            <Input
              size="lg"
              id="preorder-pay-within"
              type="number"
              min={1}
              max={90}
              value={String(form.payWithinDays)}
              onChange={(e) => patch({ payWithinDays: toDays(e.target.value, 1) })}
            />
          </Field>
        ) : null}

        <div>
          <Button onClick={handleSave} disabled={saving}>
            <Save aria-hidden="true" />
            {copy.save}
          </Button>
        </div>
      </FieldGroup>
    </SettingsCard>
  )
}
