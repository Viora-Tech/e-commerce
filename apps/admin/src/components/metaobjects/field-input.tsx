'use client'

import {
  type FieldRule,
  type FieldType,
  isReferenceType,
  NO_LIST_TYPES,
} from '@commerce/core/metaobjects'
import type { RichTextValue } from '@commerce/richtext'
import { Plus, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { useId } from 'react'
import RichTextField from '@/components/fields/rich-text-field'
import { entryFormContent, fieldInputContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import ChoiceInput from './choice-input'
import GroupInput from './group-input'
import ReferencePicker from './reference-picker'
import type { ReferenceKind } from './reference-search-dialog'
import ScalarInput from './scalar-input'

type FieldInputProps = {
  rule: FieldRule & { description?: string | null | undefined }
  value: unknown
  error?: string | undefined
  onChange: (value: unknown) => void
  /** In a grid whose column header names the field: the label is only read out, not shown. */
  hideLabel?: boolean | undefined
}

const KIND: Partial<Record<FieldType, ReferenceKind>> = {
  file: 'file',
  product_reference: 'product',
  collection_reference: 'collection',
  metaobject_reference: 'metaobject',
  page_reference: 'page',
  variant_reference: 'variant',
  article_reference: 'article',
}

function asIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return typeof value === 'string' && value ? [value] : []
}

function asItems(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.length ? value : ['']
  return value === undefined || value === null ? [''] : [value]
}

/** The right input for a metaobject field or metafield, with its label, help and error. */
export default function FieldInput({
  rule,
  value,
  error,
  onChange,
  hideLabel = false,
}: FieldInputProps) {
  // Hooks
  const id = useId()
  const copy = useCopy(fieldInputContent)
  const { required } = useCopy(entryFormContent)

  // Helpers
  const setItem = (items: unknown[], index: number, next: unknown) =>
    onChange(items.map((v, i) => (i === index ? next : v)))

  // Early returns
  if (rule.type === 'rich_text') {
    return (
      <RichTextField
        label={rule.name}
        value={(value as RichTextValue | null) ?? null}
        onChange={onChange}
        helpText={rule.description ?? undefined}
        error={error}
        required={rule.required}
        minHeight={160}
      />
    )
  }

  // Render logic
  const list = rule.list && !NO_LIST_TYPES.includes(rule.type)
  const items = asItems(value)
  const kind = isReferenceType(rule.type) ? KIND[rule.type] : undefined

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id} className={hideLabel ? 'sr-only' : undefined}>
        {rule.name}
        {rule.required ? (
          <span className="text-caption font-normal text-muted-foreground">{required}</span>
        ) : null}
      </FieldLabel>
      {kind ? (
        <ReferencePicker
          kind={kind}
          definitionId={rule.validations?.metaobjectDefinitionId}
          value={asIds(value)}
          multiple={list}
          onChange={(ids) => onChange(list ? ids : (ids[0] ?? null))}
        />
      ) : rule.type === 'group' ? (
        <GroupInput
          id={id}
          subfields={rule.validations?.subfields ?? []}
          maxRows={rule.validations?.maxItems}
          value={value}
          invalid={Boolean(error)}
          onChange={onChange}
        />
      ) : rule.type === 'choice' && list ? (
        <ChoiceInput
          id={id}
          choices={rule.validations?.choices ?? []}
          multiple
          value={value}
          invalid={Boolean(error)}
          onChange={onChange}
        />
      ) : list ? (
        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: list items have no identity beyond their position.
            <div key={index} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <ScalarInput
                  id={index === 0 ? id : `${id}-${index}`}
                  type={rule.type}
                  value={item}
                  rules={rule.validations}
                  invalid={Boolean(error)}
                  onChange={(next) => setItem(items, index, next)}
                />
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={copy.removeItem}
                disabled={items.length === 1 && (item === '' || item === null)}
                onClick={() => onChange(items.filter((_, i) => i !== index))}
              >
                <X />
              </Button>
            </div>
          ))}
          <Button variant="outline" className="self-start" onClick={() => onChange([...items, ''])}>
            <Plus />
            {copy.addItem}
          </Button>
        </div>
      ) : (
        <ScalarInput
          id={id}
          type={rule.type}
          value={value}
          rules={rule.validations}
          invalid={Boolean(error)}
          onChange={onChange}
        />
      )}
      {rule.description ? <FieldDescription>{rule.description}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
