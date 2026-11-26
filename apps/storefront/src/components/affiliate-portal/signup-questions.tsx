'use client'

import type { SignupField } from '@commerce/plugin-affiliates/settings'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Textarea } from '@commerce/ui/shadcn/textarea'

type SignupQuestionsProps = {
  fields: SignupField[]
  values: Record<string, string | boolean>
  onChange: (id: string, value: string | boolean) => void
}

/** A program's own signup questions (text, long text, link, number, choice, tick box). */
export default function SignupQuestions({ fields, values, onChange }: SignupQuestionsProps) {
  // Render logic
  return (
    <>
      {fields.map((f) => {
        const id = `aff-q-${f.id}`
        const value = values[f.id]
        const text = typeof value === 'string' ? value : ''
        const label = (
          <>
            {f.label}
            {f.required ? (
              <span aria-hidden className="text-destructive">
                {' *'}
              </span>
            ) : null}
          </>
        )
        if (f.kind === 'checkbox')
          return (
            <Field key={f.id} orientation="horizontal">
              <Checkbox
                id={id}
                checked={value === true}
                onCheckedChange={(on) => onChange(f.id, on === true)}
              />
              <FieldLabel htmlFor={id}>{label}</FieldLabel>
            </Field>
          )
        return (
          <Field key={f.id}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {f.kind === 'textarea' ? (
              <Textarea
                id={id}
                maxLength={1000}
                required={f.required}
                value={text}
                onChange={(e) => onChange(f.id, e.target.value)}
              />
            ) : f.kind === 'select' ? (
              <NativeSelect
                id={id}
                required={f.required}
                value={text}
                onChange={(e) => onChange(f.id, e.target.value)}
              >
                <NativeSelectOption value="" />
                {f.options.map((o) => (
                  <NativeSelectOption key={o} value={o}>
                    {o}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            ) : (
              <Input
                id={id}
                type={f.kind === 'url' ? 'url' : f.kind === 'number' ? 'number' : 'text'}
                maxLength={1000}
                required={f.required}
                value={text}
                onChange={(e) => onChange(f.id, e.target.value)}
              />
            )}
          </Field>
        )
      })}
    </>
  )
}
