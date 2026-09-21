'use client'

import { type EditorMedia, RichTextEditor } from '@commerce/editor'
import type { RichTextValue } from '@commerce/richtext'
import { cn } from '@commerce/ui/lib/utils'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { useId } from 'react'
import '@commerce/editor/editor.css'

type RichTextFieldProps = {
  label: string
  value: RichTextValue | null | undefined
  onChange: (value: RichTextValue) => void
  helpText?: string | undefined
  error?: string | undefined
  placeholder?: string | undefined
  media?: EditorMedia | null | undefined
  maxLength?: number | undefined
  minHeight?: number | undefined
  required?: boolean | undefined
}

/** shadcn Field wrapper (label / help / error) around the shared Lexical editor. */
export function RichTextField({
  label,
  value,
  onChange,
  helpText,
  error,
  placeholder,
  media,
  maxLength,
  minHeight,
  required,
}: RichTextFieldProps) {
  const id = useId()

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={id}>
        {label}
        {required ? <span aria-hidden="true">*</span> : null}
      </FieldLabel>
      <RichTextEditor
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        media={media}
        maxLength={maxLength}
        minHeight={minHeight}
        className={cn('rich-text-field__editor', error && 'rich-text-field__editor--error')}
      />
      {helpText && !error ? <FieldDescription>{helpText}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
