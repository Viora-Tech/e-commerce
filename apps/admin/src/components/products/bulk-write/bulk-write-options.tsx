'use client'

import {
  BULK_WRITE_FIELDS,
  type BulkWriteField,
  WRITER_LANGUAGES,
  WRITER_TONES,
  type WriterLanguage,
  type WriterTone,
} from '@commerce/ai/client'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { aiContent } from '@/data/ai'
import { assistantContent } from '@/data/assistant'
import { useCopy } from '@/hooks/use-copy'

type BulkWriteOptionsProps = {
  fields: BulkWriteField[]
  language: WriterLanguage
  tone: WriterTone
  disabled: boolean
  onFields: (fields: BulkWriteField[]) => void
  onLanguage: (language: WriterLanguage) => void
  onTone: (tone: WriterTone) => void
}

const pill =
  'h-8 rounded-full border px-3 text-caption font-medium transition-colors disabled:opacity-60'

/** What a bulk run writes (fields), in which language and tone. */
export default function BulkWriteOptions({
  fields,
  language,
  tone,
  disabled,
  onFields,
  onLanguage,
  onTone,
}: BulkWriteOptionsProps) {
  // Hooks
  const copy = useCopy(assistantContent)
  const { writer } = useCopy(aiContent)

  // Helpers
  const toggle = (field: BulkWriteField, on: boolean) =>
    onFields(on ? [...fields, field] : fields.filter((f) => f !== field))

  return (
    <div className="flex flex-col gap-5">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-body font-medium text-ink-strong">
          {copy.bulk.fieldsLabel}
        </legend>
        {BULK_WRITE_FIELDS.map((field) => (
          <label
            key={field}
            htmlFor={`bulk-field-${field}`}
            className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/40"
          >
            <Checkbox
              id={`bulk-field-${field}`}
              checked={fields.includes(field)}
              onCheckedChange={(on) => toggle(field, on === true)}
              disabled={disabled}
            />
            <span className="text-body text-foreground">{copy.bulk.fields[field] ?? field}</span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-col gap-2">
        <span className="text-body font-medium text-ink-strong">{copy.bulk.languageLabel}</span>
        <div className="flex flex-wrap gap-2">
          {WRITER_LANGUAGES.map((l) => (
            <button
              key={l}
              type="button"
              disabled={disabled}
              aria-pressed={language === l}
              onClick={() => onLanguage(l)}
              className={`${pill} ${language === l ? 'border-action bg-action text-action-foreground' : 'border-input bg-card text-foreground hover:bg-muted/60'}`}
            >
              {writer.languages[l]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-body font-medium text-ink-strong">{copy.bulk.toneLabel}</span>
        <div className="flex flex-wrap gap-2">
          {WRITER_TONES.map((t) => (
            <button
              key={t}
              type="button"
              disabled={disabled}
              aria-pressed={tone === t}
              onClick={() => onTone(t)}
              className={`${pill} ${tone === t ? 'border-action bg-action text-action-foreground' : 'border-input bg-card text-foreground hover:bg-muted/60'}`}
            >
              {writer.tones[t]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
