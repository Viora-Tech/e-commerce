'use client'

import { type EditorMedia, RichTextEditor } from '@commerce/editor'
import type { RichTextValue } from '@commerce/richtext'
import { cn } from '@commerce/ui/lib/utils'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { useId } from 'react'
import '@/styles/vendor-editor.css'

type RichTextFieldProps = {
  label: string
  value: RichTextValue | null | undefined
  onChange: (value: RichTextValue) => void
  helpText?: string | undefined
  error?: string | undefined
  placeholder?: string | undefined
  media?: EditorMedia | null | undefined
  maxLength?: number | undefined
  minHeight?: number | string | undefined
  required?: boolean | undefined
  className?: string | undefined
}

/** shadcn Field wrapper (label / help / error) around the shared Lexical editor. */
export default function RichTextField({
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
  className,
}: RichTextFieldProps) {
  // Hooks
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
        className={cn(error && 'rounded-lg ring-2 ring-destructive/30', className)}
      />
      {helpText && !error ? <FieldDescription>{helpText}</FieldDescription> : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
