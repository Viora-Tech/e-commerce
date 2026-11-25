'use client'

import { InfoIcon } from '@commerce/ui/icons'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import DataCard from '@/components/layout/data-card'
import { loyaltyRulesContent } from '@/data/loyalty-rules'
import { useCopy } from '@/hooks/use-copy'
import { type RuleForm, ruleNeedsUrl, validUrl } from '@/lib/loyalty-rules'

type RuleFieldsProps = {
  form: RuleForm
  name: string
  onChange: (patch: Partial<RuleForm>) => void
}

const ACTIONS = ['follow', 'join', 'subscribe', 'visit'] as const

const whole = (raw: string, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(Number(raw) || 0)))

/** The rule sheet's left column: the customer title card, then "Points earned" with its fields. */
export default function RuleFields({ form, name, onChange }: RuleFieldsProps) {
  // Hooks
  const copy = useCopy(loyaltyRulesContent)

  // Render logic
  const e = copy.editor
  const needsUrl = ruleNeedsUrl(form.type)
  const urlBad = needsUrl && form.url !== '' && !validUrl(form.url)

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <DataCard>
        <Field>
          <FieldLabel htmlFor="rule-title" className="flex items-center gap-1.5">
            {e.title}
            <span title={e.titleHelp} className="text-muted-foreground">
              <InfoIcon className="size-3.5" />
            </span>
          </FieldLabel>
          <Input
            id="rule-title"
            size="lg"
            maxLength={120}
            placeholder={name}
            value={form.title}
            onChange={(ev) => onChange({ title: ev.target.value })}
          />
          <FieldDescription>{e.titleHelp}</FieldDescription>
        </Field>
      </DataCard>
      <section className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-card-title text-ink-strong">{e.pointsEarned}</h3>
          <p className="text-caption text-muted-foreground">
            {e.frequency[form.type] ?? e.frequency.default}
          </p>
        </div>
        <DataCard>
          <div className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rule-points">{e.customerGets}</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    id="rule-points"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={form.points}
                    onChange={(ev) => onChange({ points: whole(ev.target.value, 0, 10_000_000) })}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupText>{e.pointsUnit}</InputGroupText>
                  </InputGroupAddon>
                </InputGroup>
              </Field>
              {form.type === 'visit_streak' ? (
                <Field>
                  <FieldLabel htmlFor="rule-days">{e.days}</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="rule-days"
                      type="number"
                      inputMode="numeric"
                      min={2}
                      max={365}
                      value={form.days}
                      onChange={(ev) => onChange({ days: whole(ev.target.value, 2, 365) })}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupText>{e.daysUnit}</InputGroupText>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldDescription>{e.daysHelp}</FieldDescription>
                </Field>
              ) : null}
              {form.type === 'social' ? (
                <Field>
                  <FieldLabel htmlFor="rule-action">{e.action}</FieldLabel>
                  <NativeSelect
                    id="rule-action"
                    value={form.action}
                    onChange={(ev) => onChange({ action: ev.target.value as RuleForm['action'] })}
                  >
                    {ACTIONS.map((a) => (
                      <NativeSelectOption key={a} value={a}>
                        {e.actions[a]}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}
            </div>
            {needsUrl ? (
              <Field data-invalid={urlBad || undefined}>
                <FieldLabel htmlFor="rule-url">{e.url}</FieldLabel>
                <Input
                  id="rule-url"
                  size="lg"
                  type="url"
                  inputMode="url"
                  maxLength={500}
                  placeholder="https://"
                  value={form.url}
                  onChange={(ev) => onChange({ url: ev.target.value })}
                />
                {urlBad ? (
                  <FieldError>{e.urlInvalid}</FieldError>
                ) : (
                  <FieldDescription>{e.urlHelp}</FieldDescription>
                )}
              </Field>
            ) : null}
            {needsUrl ? <p className="text-caption text-muted-foreground">{e.honour}</p> : null}
          </div>
        </DataCard>
      </section>
    </div>
  )
}
