'use client'

import { FONT_IDS, TEMPLATE_IDS } from '@commerce/invoices'
import { cn } from '@commerce/ui/lib/utils'
import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { gstInvoicesContent } from '@/data/gst-invoices'
import ChoiceField from './choice-field'
import EditorGroup from './editor-group'
import type { GroupProps } from './types'

const copy = gstInvoicesContent.settings.groups.look

const SWATCHES = ['#1f2937', '#1f6feb', '#0f766e', '#b45309', '#be123c', '#6d28d9', '#000000']
const FONTS = FONT_IDS.map((f) => ({ value: f, label: copy.fonts[f] }))
const PAPERS = [
  { value: 'A4', label: 'A4' },
  { value: 'A5', label: 'A5' },
]

/** Template cards, accent colour, font and paper: the invoicely theme panel. */
export default function LookGroup({ settings, onChange, errors }: GroupProps) {
  return (
    <EditorGroup title={copy.title} body={copy.body} defaultOpen>
      <Field>
        <FieldLabel>{copy.template}</FieldLabel>
        <div className="grid gap-2 sm:grid-cols-3">
          {TEMPLATE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={settings.template === id}
              onClick={() => onChange({ ...settings, template: id })}
              className={cn(
                'flex flex-col items-start gap-1 rounded-[0.625rem] border p-3 text-left transition-colors hover:border-ring',
                settings.template === id ? 'border-ring bg-secondary' : 'border-border',
              )}
            >
              <span className="text-body font-medium">{copy.templates[id].label}</span>
              <span className="text-caption text-muted-foreground">
                {copy.templates[id].description}
              </span>
            </button>
          ))}
        </div>
      </Field>
      <Field data-invalid={errors.accentColor ? true : undefined}>
        <FieldLabel htmlFor="gst-color">{copy.color}</FieldLabel>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              aria-pressed={settings.accentColor === c}
              onClick={() => onChange({ ...settings, accentColor: c })}
              className={cn(
                'size-7 rounded-full border border-border ring-offset-2 ring-offset-background',
                settings.accentColor === c && 'ring-2 ring-ring',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            aria-label={copy.color}
            value={settings.accentColor}
            onChange={(e) => onChange({ ...settings, accentColor: e.target.value })}
            className="size-7 cursor-pointer rounded-full border border-border bg-transparent"
          />
          <Input
            id="gst-color"
            size="lg"
            value={settings.accentColor}
            maxLength={7}
            onChange={(e) => onChange({ ...settings, accentColor: e.target.value })}
            className="w-28 font-mono"
          />
        </div>
        {errors.accentColor ? <FieldError>{errors.accentColor}</FieldError> : null}
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <ChoiceField
          id="gst-font"
          label={copy.font}
          value={settings.font}
          options={FONTS}
          onChange={(v) => onChange({ ...settings, font: v as typeof settings.font })}
        />
        <ChoiceField
          id="gst-paper"
          label={copy.paper}
          value={settings.paper}
          options={PAPERS}
          onChange={(v) => onChange({ ...settings, paper: v as typeof settings.paper })}
        />
      </div>
    </EditorGroup>
  )
}
