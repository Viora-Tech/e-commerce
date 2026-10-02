'use client'

import {
  WRITER_LANGUAGES,
  WRITER_TONES,
  type WriterLanguage,
  type WriterTone,
} from '@commerce/ai/client'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { aiContent } from '@/data/ai'
import { useCopy } from '@/hooks/use-copy'

type AiWriterOptionsProps = {
  tone: WriterTone
  language: WriterLanguage
  notes: string
  photoCount: number
  disabled: boolean
  onTone: (tone: WriterTone) => void
  onLanguage: (language: WriterLanguage) => void
  onNotes: (notes: string) => void
}

const NOTES_MAX = 2000

function first<T extends string>(values: string[], allowed: readonly T[]): T | null {
  const picked = values[0]
  return picked && (allowed as readonly string[]).includes(picked) ? (picked as T) : null
}

/** "Write with AI" inputs: tone, language and optional notes, plus which photos it reads. */
export default function AiWriterOptions({
  tone,
  language,
  notes,
  photoCount,
  disabled,
  onTone,
  onLanguage,
  onNotes,
}: AiWriterOptionsProps) {
  // Hooks
  const copy = useCopy(aiContent)

  // Event handlers
  const handleTone = (values: string[]) => {
    const next = first(values, WRITER_TONES)
    if (next) onTone(next)
  }

  const handleLanguage = (values: string[]) => {
    const next = first(values, WRITER_LANGUAGES)
    if (next) onLanguage(next)
  }

  // Render logic
  return (
    <div className="flex flex-col gap-5">
      <Field>
        <FieldLabel id="ai-tone-label">{copy.writer.toneLabel}</FieldLabel>
        <ToggleGroup
          aria-labelledby="ai-tone-label"
          value={[tone]}
          onValueChange={handleTone}
          variant="outline"
          className="flex-wrap"
          disabled={disabled}
        >
          {WRITER_TONES.map((t) => (
            <ToggleGroupItem key={t} value={t}>
              {copy.writer.tones[t]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      <Field>
        <FieldLabel id="ai-language-label">{copy.writer.languageLabel}</FieldLabel>
        <ToggleGroup
          aria-labelledby="ai-language-label"
          value={[language]}
          onValueChange={handleLanguage}
          variant="outline"
          spacing={0}
          disabled={disabled}
        >
          {WRITER_LANGUAGES.map((l) => (
            <ToggleGroupItem key={l} value={l}>
              {copy.writer.languages[l]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
      <Field>
        <FieldLabel htmlFor="ai-notes">{copy.writer.notesLabel}</FieldLabel>
        <Textarea
          id="ai-notes"
          value={notes}
          onChange={(e) => onNotes(e.target.value.slice(0, NOTES_MAX))}
          placeholder={copy.writer.notesPlaceholder}
          rows={3}
          disabled={disabled}
        />
        <FieldDescription>{copy.writer.photos(photoCount)}</FieldDescription>
      </Field>
    </div>
  )
}
