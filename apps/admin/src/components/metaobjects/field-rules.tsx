'use client'

import {
  DEFAULT_RATING_MAX,
  FIELD_CURRENCIES,
  type FieldType,
  type FieldValidations,
  MEASURE_KINDS,
} from '@commerce/core/metaobjects'
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
import { currencyContent, fieldDialogContent, measureContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import GroupFieldsEditor from './group-fields-editor'

type FieldRulesProps = {
  type: FieldType
  list: boolean
  validations: FieldValidations
  /** Metaobject definitions a reference can point at. */
  targets: { id: string; name: string }[]
  /** Fixed once saved (metafield definitions cannot retarget). */
  targetLocked?: boolean | undefined
  /** Entries already hold values: the unit kind and currency stay as they are. */
  shapeLocked?: boolean | undefined
  /** A group's row fields that rows already use: their kind of value is fixed. */
  lockedRowKeys?: readonly string[] | undefined
  onChange: (validations: FieldValidations) => void
}

const TEXT_TYPES: FieldType[] = ['single_line_text', 'multi_line_text']
const NUMBER_TYPES: FieldType[] = ['number_integer', 'number_decimal']
const RATING_SCALES = [5, 10]

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

const lines = (text: string) =>
  text
    .split('\n')
    .map((c) => c.trim())
    .filter(Boolean)

/** The validation inputs that make sense for a field type. */
export default function FieldRules({
  type,
  list,
  validations: v,
  targets,
  targetLocked,
  shapeLocked,
  lockedRowKeys,
  onChange,
}: FieldRulesProps) {
  // Hooks
  const copy = useCopy(fieldDialogContent)
  const currencies = useCopy(currencyContent)
  const measures = useCopy(measureContent)
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

  const choicesInput = (label: string, help: string) => (
    <Field>
      <FieldLabel htmlFor={`${id}-choices`}>{label}</FieldLabel>
      <Textarea
        id={`${id}-choices`}
        size="lg"
        rows={3}
        value={(v.choices ?? []).join('\n')}
        onChange={(e) => set('choices', lines(e.target.value))}
      />
      <FieldDescription>{help}</FieldDescription>
    </Field>
  )

  const select = (
    key: 'currency' | 'measure' | 'ratingMax' | 'metaobjectDefinitionId',
    label: string,
    items: Record<string, string>,
    opts: { value: string | null; placeholder?: string; disabled?: boolean | undefined },
  ) => (
    <Field>
      <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
      <Select
        items={items}
        value={opts.value}
        disabled={opts.disabled}
        onValueChange={(next) =>
          set(key, next === null ? undefined : key === 'ratingMax' ? Number(next) : String(next))
        }
      >
        <SelectTrigger id={`${id}-${key}`} size="lg" className="w-full">
          <SelectValue placeholder={opts.placeholder} />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([value, text]) => (
            <SelectItem key={value} value={value}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )

  // Render logic
  const targetItems = Object.fromEntries(targets.map((t) => [t.id, t.name]))
  const scaleItems = Object.fromEntries(
    RATING_SCALES.map((n) => [String(n), copy.ratingMaxOption(n)]),
  )

  return (
    <div className="flex flex-col gap-3">
      {TEXT_TYPES.includes(type)
        ? pair('minLength', 'maxLength', [copy.minLength, copy.maxLength], 'number')
        : null}
      {NUMBER_TYPES.includes(type) ? pair('min', 'max', [copy.min, copy.max], 'number') : null}
      {type === 'date' ? pair('min', 'max', [copy.minDate, copy.maxDate], 'date') : null}
      {type === 'single_line_text' ? choicesInput(copy.choices, copy.choicesHelp) : null}
      {type === 'choice' ? choicesInput(copy.choiceList, copy.choiceListHelp) : null}
      {type === 'money'
        ? select(
            'currency',
            copy.currency,
            Object.fromEntries(FIELD_CURRENCIES.map((c) => [c, currencies[c]])),
            { value: v.currency ?? 'INR', disabled: shapeLocked },
          )
        : null}
      {type === 'measurement'
        ? select(
            'measure',
            copy.measure,
            Object.fromEntries(MEASURE_KINDS.map((k) => [k, measures.kinds[k]])),
            {
              value: v.measure ?? null,
              placeholder: copy.measurePlaceholder,
              disabled: shapeLocked,
            },
          )
        : null}
      {type === 'rating'
        ? select('ratingMax', copy.ratingMax, scaleItems, {
            value: String(v.ratingMax ?? DEFAULT_RATING_MAX),
          })
        : null}
      {type === 'metaobject_reference' ? (
        targets.length === 0 ? (
          <Field>
            <FieldLabel>{copy.target}</FieldLabel>
            <FieldDescription>{copy.noTargets}</FieldDescription>
          </Field>
        ) : (
          select('metaobjectDefinitionId', copy.target, targetItems, {
            value: v.metaobjectDefinitionId ?? null,
            placeholder: copy.targetPlaceholder,
            disabled: targetLocked,
          })
        )
      ) : null}
      {type === 'group' ? (
        <GroupFieldsEditor
          subfields={v.subfields ?? []}
          lockedKeys={lockedRowKeys ?? []}
          renderRules={(sub, change) => (
            <FieldRules
              type={sub.type}
              list={false}
              validations={sub.validations ?? {}}
              targets={[]}
              shapeLocked={lockedRowKeys?.includes(sub.key)}
              onChange={(validations) => change({ ...sub, validations })}
            />
          )}
          onChange={(subfields) => set('subfields', subfields)}
        />
      ) : null}
      {list || type === 'group' ? (
        <Field>
          <FieldLabel htmlFor={`${id}-max-items`}>
            {type === 'group' ? copy.maxRows : copy.maxItems}
          </FieldLabel>
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
