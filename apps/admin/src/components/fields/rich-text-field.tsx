'use client'

import type { EditorMedia } from '@commerce/editor'
import type { RichTextValue } from '@commerce/richtext'
import { cn } from '@commerce/ui/lib/utils'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import dynamic from 'next/dynamic'
import { useId } from 'react'
import RequiredMark from '@/components/fields/required-mark'
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

/* Lexical and its plugins are large: they load in their own chunk, after the page is up. The box
   stands in for the toolbar and a short writing area meanwhile, so the form below barely moves. */
const RichTextEditor = dynamic(() => import('@commerce/editor').then((m) => m.RichTextEditor), {
  ssr: false,
  loading: () => (
    <div
      className="min-h-52 animate-pulse rounded-lg border border-input bg-muted/40"
      aria-hidden
    />
  ),
})

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
        {required ? <RequiredMark /> : null}
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
