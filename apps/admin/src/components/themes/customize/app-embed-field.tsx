'use client'

import { AutoField, type Field } from '@puckeditor/core'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import { toHex } from '@/lib/theme-quick-settings'
import SwatchRow from './swatch-row'

/** An app embed's setting as the app declares it (Puck field + our `metadata` hints). */
export type AppEmbedFieldDef = Field & {
  label?: string
  metadata?: { colour?: boolean; optional?: boolean; advanced?: boolean; help?: string }
}

type AppEmbedFieldProps = {
  field: AppEmbedFieldDef
  value: unknown
  onChange: (value: unknown) => void
}

/**
 * One setting of an app embed in the App embeds panel. Colours (`metadata.colour`) get the
 * theme's own swatch row, with "Clear" for an optional one; every other setting is Puck's
 * `AutoField`, drawn by the editor's field overrides, which label it once.
 */
export default function AppEmbedField({ field, value, onChange }: AppEmbedFieldProps) {
  // Hooks
  const copy = useCopy(customizeContent.appEmbeds)

  // Early returns
  if (field.metadata?.colour) {
    const label = field.label ?? ''
    const help = field.metadata.help ? (
      <p className="text-caption text-muted-foreground">{field.metadata.help}</p>
    ) : null
    const hex = typeof value === 'string' ? toHex(value) : null
    if (!hex) {
      return (
        <div className="flex flex-col gap-1">
          <label
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg ${CHROME_FOCUS} focus-within:ring-2 focus-within:ring-ring`}
          >
            <span className="relative size-7 shrink-0 overflow-hidden rounded-[0.5rem] border border-dashed border-border">
              <input
                type="color"
                value="#ffffff"
                onChange={(e) => onChange(e.target.value.toUpperCase())}
                aria-label={label}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </span>
            <span className="min-w-0 flex-1 text-caption leading-[1.1875rem] font-medium text-foreground wrap-break-word">
              {label}
            </span>
            <span className="px-1.5 text-xs leading-[1.0625rem] text-muted-foreground">
              {copy.colourNone}
            </span>
          </label>
          {help}
        </div>
      )
    }
    return (
      <div className="flex flex-col gap-1">
        <SwatchRow label={label} value={hex} onChange={onChange} />
        {field.metadata.optional ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className={`w-fit rounded-sm text-xs text-link hover:underline ${CHROME_FOCUS}`}
          >
            {copy.colourClear}
          </button>
        ) : null}
        {help}
      </div>
    )
  }

  // Render logic
  return <AutoField field={field} value={value} onChange={onChange} />
}
