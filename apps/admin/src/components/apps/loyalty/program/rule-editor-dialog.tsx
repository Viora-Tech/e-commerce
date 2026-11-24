'use client'

import type { EarnRuleRow } from '@commerce/core'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { useState } from 'react'
import { toast } from 'sonner'
import SwitchRow from '@/components/fields/switch-row'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import FormDialog from '@/components/layout/form-dialog'
import { loyaltyRulesContent } from '@/data/loyalty-rules'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { type RuleForm, ruleInputOf, ruleNeedsUrl, validUrl } from '@/lib/loyalty-rules'

type RuleEditorDialogProps = {
  form: RuleForm
  /** The rule's standard name ("Follow on Instagram"). */
  name: string
  onClose: () => void
  onSaved: (row: EarnRuleRow) => void
  onRemoved: (id: string) => void
}

const ACTIONS = ['follow', 'join', 'subscribe', 'visit'] as const

/** One earning rule: points, its link (social, Google review), days (streak), title and on/off. */
export default function RuleEditorDialog({
  form: start,
  name,
  onClose,
  onSaved,
  onRemoved,
}: RuleEditorDialogProps) {
  // Hooks
  const copy = useCopy(loyaltyRulesContent)
  const [form, setForm] = useState(start)
  const [removing, setRemoving] = useState(false)

  // Helpers
  const set = (patch: Partial<RuleForm>) => setForm((f) => ({ ...f, ...patch }))

  // Event handlers
  const handleSubmit = async () => {
    try {
      const row = await api.loyalty.rules.save({ id: form.id, rule: ruleInputOf(form) })
      toast.success(copy.editor.saved)
      onSaved(row)
    } catch (err) {
      toast.error(errorText(err, copy.editor.failed))
    }
  }

  const handleRemove = async () => {
    if (!form.id) return
    await api.loyalty.rules.remove({ id: form.id })
    toast.success(copy.editor.removed)
    onRemoved(form.id)
  }

  // Render logic
  const e = copy.editor
  const needsUrl = ruleNeedsUrl(form.type)
  const urlBad = needsUrl && !validUrl(form.url)
  const dirty = JSON.stringify(form) !== JSON.stringify(start)

  return (
    <>
      <FormDialog
        open
        onOpenChange={(open) => (!open ? onClose() : undefined)}
        title={form.id ? e.editTitle(name) : e.newTitle(name)}
        description={copy.hints[form.type]}
        submitLabel={form.id ? e.save : e.add}
        submitDisabled={urlBad || form.points < 0}
        dirty={dirty}
        onSubmit={handleSubmit}
        secondaryAction={
          form.id ? (
            <Button variant="ghost" className="text-destructive" onClick={() => setRemoving(true)}>
              {e.remove}
            </Button>
          ) : null
        }
      >
        <div className="flex flex-col gap-5">
          <Field>
            <FieldLabel htmlFor="rule-points">{e.points}</FieldLabel>
            <Input
              id="rule-points"
              size="lg"
              type="number"
              inputMode="numeric"
              min={0}
              className="w-40"
              value={form.points}
              onChange={(ev) => set({ points: Math.max(0, Math.round(Number(ev.target.value))) })}
            />
            <FieldDescription>{e.pointsHelp}</FieldDescription>
          </Field>
          {needsUrl ? (
            <Field data-invalid={(urlBad && form.url !== '') || undefined}>
              <FieldLabel htmlFor="rule-url">{e.url}</FieldLabel>
              <Input
                id="rule-url"
                size="lg"
                type="url"
                inputMode="url"
                maxLength={500}
                placeholder="https://"
                value={form.url}
                onChange={(ev) => set({ url: ev.target.value })}
              />
              {urlBad && form.url !== '' ? (
                <FieldError>{e.urlInvalid}</FieldError>
              ) : (
                <FieldDescription>{e.urlHelp}</FieldDescription>
              )}
            </Field>
          ) : null}
          {form.type === 'social' ? (
            <Field>
              <FieldLabel htmlFor="rule-action">{e.action}</FieldLabel>
              <NativeSelect
                id="rule-action"
                value={form.action}
                onChange={(ev) => set({ action: ev.target.value as RuleForm['action'] })}
              >
                {ACTIONS.map((a) => (
                  <NativeSelectOption key={a} value={a}>
                    {e.actions[a]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          {form.type === 'visit_streak' ? (
            <Field>
              <FieldLabel htmlFor="rule-days">{e.days}</FieldLabel>
              <Input
                id="rule-days"
                size="lg"
                type="number"
                inputMode="numeric"
                min={2}
                max={365}
                className="w-40"
                value={form.days}
                onChange={(ev) =>
                  set({ days: Math.min(365, Math.max(2, Math.round(Number(ev.target.value)))) })
                }
              />
              <FieldDescription>{e.daysHelp}</FieldDescription>
            </Field>
          ) : null}
          <Field>
            <FieldLabel htmlFor="rule-title">{e.title}</FieldLabel>
            <Input
              id="rule-title"
              size="lg"
              maxLength={120}
              placeholder={name}
              value={form.title}
              onChange={(ev) => set({ title: ev.target.value })}
            />
            <FieldDescription>{e.titleHelp}</FieldDescription>
          </Field>
          <SwitchRow
            label={e.enabled}
            description={e.enabledHelp}
            checked={form.enabled}
            onChange={(enabled) => set({ enabled })}
          />
          {needsUrl ? <p className="text-caption text-muted-foreground">{e.honour}</p> : null}
        </div>
      </FormDialog>
      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title={e.removeTitle}
        body={e.removeBody}
        confirmLabel={e.remove}
        tone="destructive"
        onConfirm={handleRemove}
      />
    </>
  )
}
