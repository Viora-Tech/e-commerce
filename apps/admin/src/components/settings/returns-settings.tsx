'use client'

import { RETURN_REASONS, type ReturnPolicy, type ReturnReason } from '@commerce/core/returns'
import { Undo } from '@commerce/ui/icons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import SaveBar from '@/components/layout/save-bar'
import ChoiceList from '@/components/returns/choice-list'
import { returnSettingsContent as copy, returnsContent } from '@/data/returns'
import { settingsContent } from '@/data/settings'
import { api } from '@/lib/api-client'

type ToggleProps = {
  id: string
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}

/* One yes/no question with a plain-language hint under it. */
function Toggle({ id, label, hint, checked, onChange }: ToggleProps) {
  return (
    <Field orientation="horizontal" className="items-start">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
      <div className="flex flex-col gap-0.5">
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <FieldDescription>{hint}</FieldDescription>
      </div>
    </Field>
  )
}

const clampDays = (raw: string): number => {
  const n = Math.round(Number(raw))
  return Number.isFinite(n) ? Math.min(90, Math.max(1, n)) : 7
}

/** Settings → Returns: the window, the reasons, auto restock and the refund default. */
export default function ReturnsSettings() {
  // Hooks
  const [form, setForm] = useState<ReturnPolicy | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.returns.policy().then((p) => {
      setForm(p)
      setSaved(JSON.stringify(p))
    })
  }, [])

  // Helpers
  const patch = (p: Partial<ReturnPolicy>) => setForm((f) => (f ? { ...f, ...p } : f))

  // Event handlers
  const handleReason = (code: ReturnReason, on: boolean) => {
    if (!form) return
    const next = on ? [...form.reasons, code] : form.reasons.filter((r) => r !== code)
    patch({ reasons: RETURN_REASONS.filter((r) => next.includes(r)) })
  }

  const handleSave = async () => {
    if (!form) return
    if (form.reasons.length === 0) {
      toast.error(copy.atLeastOne)
      return
    }
    setBusy(true)
    try {
      const next = await api.returns.savePolicy(form)
      setForm(next)
      setSaved(JSON.stringify(next))
      toast.success(copy.saved)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleDiscard = () => {
    if (saved) setForm(JSON.parse(saved) as ReturnPolicy)
  }

  // Render logic
  const dirty = form !== null && saved !== null && JSON.stringify(form) !== saved

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <SaveBar
        open={dirty}
        message={settingsContent.general.unsaved}
        saveLabel={copy.save}
        discardLabel={settingsContent.general.discard}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={busy}
      />
      <PageHeader title={copy.title} subtitle={copy.subtitle} icon={<Undo aria-hidden="true" />} />
      {!form ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <>
          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Toggle
                  id="returns-enabled"
                  label={copy.enabled}
                  hint={copy.enabledHint}
                  checked={form.enabled}
                  onChange={(enabled) => patch({ enabled })}
                />
                <Field>
                  <FieldLabel htmlFor="returns-window">{copy.window}</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input
                      size="lg"
                      id="returns-window"
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="90"
                      className="w-24"
                      value={form.windowDays}
                      onChange={(e) => patch({ windowDays: clampDays(e.target.value) })}
                    />
                    <span className="text-body text-muted-foreground">{copy.days}</span>
                  </div>
                  <FieldDescription>{copy.windowHint}</FieldDescription>
                </Field>
                <Toggle
                  id="returns-restock"
                  label={copy.restock}
                  hint={copy.restockHint}
                  checked={form.restockAutomatically}
                  onChange={(restockAutomatically) => patch({ restockAutomatically })}
                />
              </FieldGroup>
            </CardContent>
          </Card>

          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.reasons}</CardTitle>
              <CardDescription>{copy.reasonsHint}</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup className="gap-3">
                {RETURN_REASONS.map((code) => (
                  <Field key={code} orientation="horizontal">
                    <Checkbox
                      id={`reason-${code}`}
                      checked={form.reasons.includes(code)}
                      onCheckedChange={(v) => handleReason(code, Boolean(v))}
                    />
                    <FieldLabel htmlFor={`reason-${code}`} className="font-normal">
                      {returnsContent.reasons[code]}
                    </FieldLabel>
                  </Field>
                ))}
              </FieldGroup>
            </CardContent>
          </Card>

          <Card size="form">
            <CardHeader>
              <CardTitle>{copy.refund}</CardTitle>
            </CardHeader>
            <CardContent>
              <ChoiceList
                name="refund-method"
                value={form.refundMethod}
                onChange={(v) =>
                  patch({ refundMethod: v === 'store_credit' ? 'store_credit' : 'original' })
                }
                choices={[
                  { value: 'original', label: copy.refundOptions.original },
                  { value: 'store_credit', label: copy.refundOptions.store_credit },
                ]}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
