'use client'

import { type ShopifySetting, schemaText, settingField } from '@commerce/core/theme-import'
import { Input } from '@commerce/ui/shadcn/input'
import { useId } from 'react'
import { FIELD_INPUT } from '@/lib/customize-field-styles'
import { fontChoices, swatchValue } from '@/lib/imported-theme-settings'
import CustomizeNumberField from './customize-number-field'
import CustomizeRadioField from './customize-radio-field'
import CustomizeSelectField from './customize-select-field'
import CustomizeTextField from './customize-text-field'
import FieldFrame from './field-frame'
import ImageField from './image-field'
import SwatchRow from './swatch-row'

type ImportedSettingFieldProps = {
  setting: ShopifySetting
  value: unknown
  /** The theme's `locales/*.schema.json`, for `t:` labels. */
  locale: Record<string, unknown>
  /** The theme's colour schemes, for a `color_scheme` setting. */
  colorSchemes: string[]
  onChange: (value: unknown) => void
}

const NOTE = 'text-xs leading-[1.0625rem] text-muted-foreground'

const plain = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** A choice field's options as the select and radio fields take them (schema values are strings or booleans). */
const choices = (field: { label: string; options: { label: string; value: unknown }[] }) => ({
  label: field.label,
  options: field.options.map((o) => ({ label: o.label, value: o.value as string | boolean })),
})

/** A stored picture as the image picker edits it: a bare address becomes `{ url }`. */
const asImage = (value: unknown) =>
  typeof value === 'string' ? { url: value, alt: '' } : (value ?? { url: '', alt: '' })

/**
 * One setting of an imported theme's Theme settings, with the editor its type calls for:
 * pictures get the media picker, colours a swatch, fonts the store's typefaces, the rest the
 * field Customize's section inspector gives the same setting (`settingField`).
 */
export default function ImportedSettingField({
  setting,
  value,
  locale,
  colorSchemes,
  onChange,
}: ImportedSettingFieldProps) {
  // Hooks
  const id = useId()

  // Early returns
  if (setting.type === 'header') {
    return (
      <h3 className="pt-2 text-xs leading-[1.0625rem] font-semibold text-foreground">
        {schemaText(setting.content, locale)}
      </h3>
    )
  }
  if (setting.type === 'paragraph') {
    return <p className={NOTE}>{plain(schemaText(setting.content, locale))}</p>
  }
  // Pictures get the media picker; other object settings (a video) are left to Edit code.
  const field = settingField(setting, locale, { colorSchemes })
  const flat = field !== null && field.type !== 'array' && field.type !== 'object'
  if (!flat && setting.type !== 'image_picker') return null

  // Render logic
  const label = schemaText(setting.label, locale) || setting.id || setting.type
  const info = setting.info ? plain(schemaText(setting.info, locale)) : ''
  const text = typeof value === 'string' ? value : ''
  const control =
    setting.type === 'color' ? (
      <SwatchRow label={label} value={swatchValue(value, setting.default)} onChange={onChange} />
    ) : setting.type === 'font_picker' ? (
      <CustomizeSelectField
        field={{ label, options: fontChoices(text) }}
        value={text || fontChoices('')[0]?.value}
        onChange={onChange}
        id={id}
        name={setting.id ?? ''}
      />
    ) : setting.type === 'image_picker' ? (
      <FieldFrame label={label}>
        <ImageField value={asImage(value)} onChange={onChange} />
      </FieldFrame>
    ) : setting.type === 'color_background' ? (
      <FieldFrame label={label} htmlFor={id}>
        <Input
          id={id}
          value={text}
          onChange={(e) => onChange(e.target.value)}
          size="lg"
          className={FIELD_INPUT}
        />
      </FieldFrame>
    ) : field?.type === 'number' ? (
      <CustomizeNumberField
        field={field}
        value={typeof value === 'number' ? value : undefined}
        onChange={onChange}
        id={id}
        name={setting.id ?? ''}
      />
    ) : field?.type === 'select' ? (
      <CustomizeSelectField
        field={choices(field)}
        value={value as string}
        onChange={onChange}
        id={id}
        name={setting.id ?? ''}
      />
    ) : field?.type === 'radio' ? (
      <CustomizeRadioField
        field={choices(field)}
        value={value as string | boolean}
        onChange={onChange}
        id={id}
        name={setting.id ?? ''}
      />
    ) : field?.type === 'text' || field?.type === 'textarea' ? (
      <CustomizeTextField
        field={field}
        value={text}
        onChange={onChange}
        id={id}
        name={setting.id ?? ''}
      />
    ) : null

  return control ? (
    <div className="flex flex-col gap-1.5">
      {control}
      {info ? <p className={NOTE}>{info}</p> : null}
    </div>
  ) : null
}
