'use client'

import type { FieldType, FieldValidations } from '@commerce/core/metaobjects'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useId } from 'react'
import { fieldDialogContent as copy } from '@/data/metaobjects'

type FieldRulesProps = {
  type: FieldType
  list: boolean
  validations: FieldValidations
  /** Metaobject definitions a reference can point at. */
  targets: { id: string; name: string }[]
  /** Fixed once saved (metafield definitions cannot retarget). */
  targetLocked?: boolean | undefined
  onChange: (validations: FieldValidations) => void
}

const TEXT_TYPES: FieldType[] = ['single_line_text', 'multi_line_text']
const NUMBER_TYPES: FieldType[] = ['number_integer', 'number_decimal']

function numberOrUndefined(raw: string): number | undefined {
  if (raw.trim() === '') return undefined
  const n = Number(raw)
  return Number.isFinite(n) ? n : undefined
}

function withRule<K extends keyof FieldValidations>(
  v: FieldValidations,
  key: K,
  value: FieldValidations[K] | undefined,
): FieldValidations {
  const next = { ...v }
  if (value === undefined || (Array.isArray(value) && value.length === 0)) delete next[key]
  else next[key] = value
  return next
}

/** The validation inputs that make sense for a field type. */
export default function FieldRules({
  type,
  list,
  validations: v,
  targets,
  targetLocked,
  onChange,
}: FieldRulesProps) {
  // Hooks
  const id = useId()

  // Helpers
  const set = <K extends keyof FieldValidations>(key: K, value: FieldValidations[K] | undefined) =>
    onChange(withRule(v, key, value))

  const pair = (
    minKey: 'min' | 'minLength',
    maxKey: 'max' | 'maxLength',
    labels: [string, string],
    inputType: 'number' | 'date',
  ) => (
    <div className="grid grid-cols-2 gap-3">
      {([minKey, maxKey] as const).map((key, i) => (
        <Field key={key}>
          <FieldLabel htmlFor={`${id}-${key}`}>{labels[i]}</FieldLabel>
          <Input
            id={`${id}-${key}`}
            size="lg"
            type={inputType}
            value={v[key] === undefined ? '' : String(v[key])}
            onChange={(e) =>
              set(
                key,
                inputType === 'date'
                  ? e.target.value || undefined
                  : numberOrUndefined(e.target.value),
              )
            }
          />
        </Field>
      ))}
    </div>
  )

  // Render logic
  const targetItems = Object.fromEntries(targets.map((t) => [t.id, t.name]))

  return (
    <div className="flex flex-col gap-3">
      {TEXT_TYPES.includes(type)
        ? pair('minLength', 'maxLength', [copy.minLength, copy.maxLength], 'number')
        : null}
      {NUMBER_TYPES.includes(type) ? pair('min', 'max', [copy.min, copy.max], 'number') : null}
      {type === 'date' ? pair('min', 'max', [copy.minDate, copy.maxDate], 'date') : null}
      {type === 'single_line_text' ? (
        <Field>
          <FieldLabel htmlFor={`${id}-choices`}>{copy.choices}</FieldLabel>
          <Textarea
            id={`${id}-choices`}
            size="lg"
            rows={3}
            value={(v.choices ?? []).join('\n')}
            onChange={(e) =>
              set(
                'choices',
                e.target.value
                  .split('\n')
                  .map((c) => c.trim())
                  .filter(Boolean),
              )
            }
          />
          <FieldDescription>{copy.choicesHelp}</FieldDescription>
        </Field>
      ) : null}
      {type === 'metaobject_reference' ? (
        <Field>
          <FieldLabel htmlFor={`${id}-target`}>{copy.target}</FieldLabel>
          {targets.length === 0 ? (
            <FieldDescription>{copy.noTargets}</FieldDescription>
          ) : (
            <Select
              items={targetItems}
              value={v.metaobjectDefinitionId ?? null}
              disabled={targetLocked}
              onValueChange={(next) =>
                set('metaobjectDefinitionId', next ? String(next) : undefined)
              }
            >
              <SelectTrigger id={`${id}-target`} className="w-full">
                <SelectValue placeholder={copy.targetPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {targets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      ) : null}
      {list ? (
        <Field>
          <FieldLabel htmlFor={`${id}-max-items`}>{copy.maxItems}</FieldLabel>
          <Input
            id={`${id}-max-items`}
            size="lg"
            type="number"
            min={1}
            value={v.maxItems ?? ''}
            onChange={(e) => set('maxItems', numberOrUndefined(e.target.value))}
          />
        </Field>
      ) : null}
    </div>
  )
}
