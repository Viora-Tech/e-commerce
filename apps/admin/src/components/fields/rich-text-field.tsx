'use client'

import { type EditorMedia, RichTextEditor } from '@commerce/editor'
import type { RichTextValue } from '@commerce/richtext'
import { InlineError, Text } from '@shopify/polaris'
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
  requiredIndicator?: boolean | undefined
}

/** Polaris-styled label / help / error wrapper around the shared Lexical editor. */
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
  requiredIndicator,
}: RichTextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className="rich-text-field">
      <div className="rich-text-field__label">
        <label htmlFor={id}>
          <Text as="span" variant="bodyMd">
            {label}
            {requiredIndicator ? <span aria-hidden="true"> *</span> : null}
          </Text>
        </label>
      </div>
      <RichTextEditor
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        media={media}
        maxLength={maxLength}
        minHeight={minHeight}
        className={
          error
            ? 'rich-text-field__editor rich-text-field__editor--error'
            : 'rich-text-field__editor'
        }
      />
      {helpText && !error ? (
        <div className="rich-text-field__help">
          <Text as="span" tone="subdued" variant="bodySm">
            {helpText}
          </Text>
        </div>
      ) : null}
      {error ? (
        <div className="rich-text-field__help">
          <InlineError message={error} fieldID={errorId} />
        </div>
      ) : null}
    </div>
  )
}
