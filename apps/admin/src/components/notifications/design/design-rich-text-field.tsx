'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { useRef } from 'react'
import { emailDesignFieldsContent } from '@/data/email-design-fields'
import { useCopy } from '@/hooks/use-copy'
import { applyMark, type Mark } from './rich-marks'

type DesignRichTextFieldProps = {
  id: string
  label: string
  value: string
  maxLength: number
  onChange: (value: string) => void
}

const MARKS: Mark[] = ['bold', 'italic', 'link', 'list', 'numbered']

/**
 * A text block's words with a small toolbar: bold, italic, link and lists. The marks are typed
 * into the text (`**bold**`), so the field stays a plain textarea with its own undo.
 */
export default function DesignRichTextField({
  id,
  label,
  value,
  maxLength,
  onChange,
}: DesignRichTextFieldProps) {
  // Hooks
  const copy = useCopy(emailDesignFieldsContent)
  const ref = useRef<HTMLTextAreaElement>(null)

  // Event handlers
  const handleMark = (mark: Mark) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = applyMark(value, start, end, mark, copy.text.linkPlaceholder)
    if (next.text.length > maxLength) return
    onChange(next.text)
    // Put the selection back on the marked words once React has drawn the new text.
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.setSelectionRange(next.start, next.end)
    })
  }

  // Render logic
  const t = copy.text

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div
        role="toolbar"
        aria-label={t.toolbar}
        aria-controls={id}
        className="flex flex-wrap gap-1"
      >
        {MARKS.map((m) => (
          <Button
            key={m}
            type="button"
            variant="outline"
            size="sm"
            aria-label={t[m]}
            title={t[m]}
            className={m === 'bold' ? 'font-bold' : m === 'italic' ? 'italic' : undefined}
            onClick={() => handleMark(m)}
          >
            {t.short[m]}
          </Button>
        ))}
      </div>
      <Textarea
        ref={ref}
        id={id}
        rows={6}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
      />
      <FieldDescription>{t.richHint}</FieldDescription>
    </Field>
  )
}
