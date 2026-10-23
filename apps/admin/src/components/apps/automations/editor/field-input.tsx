'use client'

import type { FieldSpec } from '@commerce/core/automations'
import type { WhatsappTemplateRef } from '@commerce/core/marketing'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import MoneyInput from '@/components/fields/money-input'
import TagInput from '@/components/fields/tag-input'
import { automationEditorContent, automationPiecesContent } from '@/data/automations'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { fieldLabel, pieceText } from '@/lib/automation-labels'
import DurationInput from './duration-input'
import KeyValueInput from './key-value-input'
import RecordField from './record-field'
import ScheduleInput from './schedule-input'
import SelectInput from './select-input'
import TemplateInput from './template-input'
import WhatsappTemplateField from './whatsapp-template-field'

type FieldInputProps = {
  /** Prefix for element ids, unique per step. */
  idPrefix: string
  spec: FieldSpec
  /** The whole config: a few fields (schedule, the order update's template) read siblings. */
  config: Record<string, unknown>
  mergeTags: string[]
  invalid: boolean
  onPatch: (patch: Record<string, unknown>) => void
}

const asString = (v: unknown) => (typeof v === 'string' ? v : '')
const asList = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
const MAX_MINUTES = 7 * 24 * 60

/** One config field of a trigger or action, drawn from its serialisable `FieldSpec`. */
export default function FieldInput({
  idPrefix,
  spec,
  config,
  mergeTags,
  invalid,
  onPatch,
}: FieldInputProps) {
  // Hooks
  const { fields: copy } = useCopy(automationEditorContent)
  const pieces = useCopy(automationPiecesContent)
  const locale = useLocale()

  // Helpers
  const set = (value: unknown) => onPatch({ [spec.key]: value })

  // Early returns
  const id = `${idPrefix}-${spec.key}`
  const label = fieldLabel(pieces, locale, spec)
  const value = config[spec.key]

  if (spec.type === 'boolean') {
    return (
      <label htmlFor={id} className="flex items-center justify-between gap-3 text-body">
        <span>{label}</span>
        <Switch id={id} checked={value === true} onCheckedChange={(on) => set(on)} />
      </label>
    )
  }

  // Render logic
  const help =
    spec.helpKey || spec.help ? pieceText(pieces, locale, spec.helpKey, spec.help, '') : null
  // The order update's template follows its channel: an order email template or a utility WhatsApp one.
  const whatsapp =
    spec.type === 'whatsapp_template' ||
    (spec.type === 'order_email_template' && config.channel === 'whatsapp')

  const control = whatsapp ? (
    <WhatsappTemplateField
      value={value && typeof value === 'object' ? (value as WhatsappTemplateRef) : null}
      onChange={set}
    />
  ) : spec.type === 'template' ? (
    <TemplateInput
      id={id}
      value={asString(value)}
      multiline={spec.multiline ?? false}
      maxLength={spec.maxLength}
      tags={mergeTags}
      invalid={invalid}
      onChange={set}
    />
  ) : spec.type === 'textarea' ? (
    <Textarea
      id={id}
      value={asString(value)}
      maxLength={spec.maxLength}
      rows={4}
      onChange={(e) => set(e.target.value)}
    />
  ) : spec.type === 'number' ? (
    <Input
      id={id}
      type="number"
      min={spec.min}
      max={spec.max}
      value={typeof value === 'number' ? value : ''}
      aria-invalid={invalid || undefined}
      onChange={(e) => set(e.target.value === '' ? undefined : Number(e.target.value))}
    />
  ) : spec.type === 'money' ? (
    <MoneyInput
      id={id}
      value={typeof value === 'number' ? String(value / 100) : ''}
      invalid={invalid}
      onChange={(v) => set(v === '' ? undefined : Math.round(Number(v) * 100))}
    />
  ) : spec.type === 'select' ? (
    <SelectInput
      id={id}
      value={asString(value) || null}
      options={spec.options.map((o) => ({
        value: o.value,
        label: pieceText(pieces, locale, o.labelKey, o.label, o.value),
      }))}
      onChange={set}
    />
  ) : spec.type === 'tags' || spec.type === 'emails' || spec.type === 'phones' ? (
    <TagInput
      id={id}
      tags={asList(value)}
      suggestions={[]}
      placeholder={
        spec.type === 'emails'
          ? copy.emailsPlaceholder
          : spec.type === 'phones'
            ? copy.phonesPlaceholder
            : copy.tagsPlaceholder
      }
      onChange={(next) => set(spec.max ? next.slice(0, spec.max) : next)}
    />
  ) : spec.type === 'record' ? (
    <RecordField
      id={id}
      kind={spec.recordType === 'location' ? 'collection' : spec.recordType}
      label={label}
      value={asString(value) || null}
      onChange={set}
    />
  ) : spec.type === 'minutes' ? (
    <DurationInput
      id={id}
      minutes={typeof value === 'number' ? value : 60}
      min={spec.min ?? 15}
      max={spec.max ?? MAX_MINUTES}
      onChange={set}
    />
  ) : spec.type === 'schedule' ? (
    <ScheduleInput id={id} config={config} onPatch={onPatch} />
  ) : spec.type === 'key_value' ? (
    <KeyValueInput
      id={id}
      rows={Array.isArray(value) ? (value as { name: string; value: string }[]) : []}
      max={spec.max ?? 20}
      onChange={set}
    />
  ) : spec.type === 'email_design' ? (
    <p className="text-caption text-muted-foreground">{copy.emailDesign}</p>
  ) : (
    // text, secret, order_email_template (by name)
    <Input
      id={id}
      value={asString(value)}
      maxLength={'maxLength' in spec ? spec.maxLength : undefined}
      aria-invalid={invalid || undefined}
      onChange={(e) => set(e.target.value)}
    />
  )

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>
        {label}
        {spec.required ? <span aria-hidden="true"> *</span> : null}
      </FieldLabel>
      {control}
      {spec.type === 'secret' ? <FieldDescription>{copy.secretHint}</FieldDescription> : null}
      {help ? <FieldDescription>{help}</FieldDescription> : null}
    </Field>
  )
}
