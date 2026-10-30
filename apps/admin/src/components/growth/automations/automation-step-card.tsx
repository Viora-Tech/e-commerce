'use client'

import { type AutomationStep, CONDITION_FIELDS } from '@commerce/core/marketing'
import { Eye, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Dialog, DialogContent, DialogTitle } from '@commerce/ui/shadcn/dialog'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import EmailContentCard from '@/components/growth/campaigns/email-content-card'
import EmailPreview from '@/components/growth/campaigns/email-preview'
import WhatsappTemplateCard, {
  type TemplatesResult,
} from '@/components/growth/campaigns/whatsapp-template-card'
import DataCard from '@/components/layout/data-card'
import { automationEditorContent, durationLabel } from '@/data/marketing-automations'

type AutomationStepCardProps = {
  step: AutomationStep
  /** Total wait before this step, for the "After 6 hours" label. */
  offsetMinutes: number
  hasCart: boolean
  templates: TemplatesResult | null
  storeName: string
  storefrontUrl: string
  onChange: (step: AutomationStep) => void
  onRemove: () => void
}

const copy = automationEditorContent.steps
const FIELD_OPTIONS = CONDITION_FIELDS.map((f) => ({ value: f, label: copy.fields[f] }))
const OP_OPTIONS = (['gte', 'lte', 'eq'] as const).map((o) => ({ value: o, label: copy.ops[o] }))
const BOOL_OPTIONS = [
  { value: 'true', label: copy.yes },
  { value: 'false', label: copy.no },
]

/** One step of an automation: its timing, its controls and the fields for its type. */
export default function AutomationStepCard({
  step,
  offsetMinutes,
  hasCart,
  templates,
  storeName,
  storefrontUrl,
  onChange,
  onRemove,
}: AutomationStepCardProps) {
  // Hooks
  const [preview, setPreview] = useState(false)

  // Render logic
  const when = offsetMinutes > 0 ? copy.after(durationLabel(offsetMinutes)) : copy.immediately
  const boolField =
    step.type === 'condition' &&
    (step.field === 'has_ordered' || step.field === 'accepts_marketing')
  const missingCode =
    step.type === 'email' &&
    // A block that makes each shopper their own code needs no fixed one.
    step.blocks.some((b) => b.type === 'discount' && !b.unique && !b.code.trim())

  return (
    <DataCard
      title={copy.types[step.type]}
      subtitle={when}
      action={
        <Button variant="ghost" size="icon" aria-label={copy.remove} onClick={onRemove}>
          <Trash2 />
        </Button>
      }
    >
      {step.type === 'wait' ? (
        <Field className="max-w-60">
          <FieldLabel htmlFor={`${step.id}-hours`}>{copy.waitFor}</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              id={`${step.id}-hours`}
              type="number"
              min={1}
              step={1}
              value={Math.max(1, Math.round(step.minutes / 60))}
              onChange={(e) =>
                onChange({ ...step, minutes: Math.max(1, Number(e.target.value) || 1) * 60 })
              }
            />
            <span className="text-body text-muted-foreground">{copy.hours}</span>
          </div>
        </Field>
      ) : null}
      {step.type === 'condition' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ChoiceField
            id={`${step.id}-field`}
            label={copy.field}
            value={step.field}
            options={FIELD_OPTIONS}
            onChange={(field) =>
              onChange({
                ...step,
                field: field as typeof step.field,
                op: field === 'has_ordered' || field === 'accepts_marketing' ? 'eq' : step.op,
                value:
                  field === 'has_ordered' || field === 'accepts_marketing' ? 'true' : step.value,
              })
            }
          />
          {boolField ? (
            <ChoiceField
              id={`${step.id}-value`}
              label={copy.value}
              value={step.value}
              options={BOOL_OPTIONS}
              onChange={(value) => onChange({ ...step, value })}
            />
          ) : (
            <>
              <ChoiceField
                id={`${step.id}-op`}
                label={copy.op}
                value={step.op}
                options={OP_OPTIONS}
                onChange={(op) => onChange({ ...step, op: op as typeof step.op })}
              />
              <Field>
                <FieldLabel htmlFor={`${step.id}-value`}>{copy.value}</FieldLabel>
                <Input
                  id={`${step.id}-value`}
                  inputMode="decimal"
                  value={step.value}
                  onChange={(e) => onChange({ ...step, value: e.target.value })}
                />
              </Field>
            </>
          )}
        </div>
      ) : null}
      {step.type === 'whatsapp' ? (
        <WhatsappTemplateCard
          bare
          value={step.template}
          templates={templates}
          onChange={(template) => template && onChange({ ...step, template })}
        />
      ) : null}
      {step.type === 'email' ? (
        <div className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${step.id}-subject`}>{copy.subject}</FieldLabel>
              <Input
                id={`${step.id}-subject`}
                value={step.subject}
                maxLength={200}
                onChange={(e) => onChange({ ...step, subject: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${step.id}-preview`}>{copy.previewText}</FieldLabel>
              <Input
                id={`${step.id}-preview`}
                value={step.previewText}
                maxLength={200}
                onChange={(e) => onChange({ ...step, previewText: e.target.value })}
              />
            </Field>
          </FieldGroup>
          {missingCode ? <p className="text-caption text-destructive">{copy.noDiscount}</p> : null}
          <EmailContentCard
            bare
            allowCart={hasCart}
            blocks={step.blocks}
            onChange={(blocks) => onChange({ ...step, blocks })}
          />
          <div>
            <Button variant="outline" size="sm" onClick={() => setPreview(true)}>
              <Eye aria-hidden="true" />
              {copy.showPreview}
            </Button>
          </div>
          <Dialog open={preview} onOpenChange={setPreview}>
            <DialogContent className="sm:max-w-3xl">
              <DialogTitle className="sr-only">{copy.showPreview}</DialogTitle>
              <EmailPreview
                storeName={storeName}
                storefrontUrl={storefrontUrl}
                subject={step.subject}
                previewText={step.previewText}
                blocks={step.blocks}
                sampleCart={hasCart}
              />
            </DialogContent>
          </Dialog>
        </div>
      ) : null}
    </DataCard>
  )
}
