'use client'

import { AutoField, type Field } from '@puckeditor/core'
import AnimationField from './animation-field'
import BackgroundField from './background-field'
import SchemeChips from './scheme-chips'
import SettingsSegmented from './settings-segmented'
import SpacingField from './spacing-field'

type SettingsGroupBodyProps = {
  /** The group's key in the section settings (`layout`, `spacing`, `style`, `advanced`). */
  group: string
  fields: Record<string, Field>
  value: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  /** Several settings of this group in one edit. */
  onPatch: (patch: Record<string, unknown>) => void
}

type Options = { label: string; value: string | number | boolean }[]

/** Section-setting keys drawn as a segmented switch instead of a dropdown. */
const SEGMENTED = new Set(['contentWidth', 'alignment', 'cornerRadius', 'shadow'])

const optionsOf = (field: Field | undefined): Options =>
  ((field as { options?: Options } | undefined)?.options ?? []) as Options

const labelOf = (field: Field | undefined, fallback: string): string =>
  (field as { label?: string } | undefined)?.label ?? fallback

const maxOf = (field: Field | undefined): number => {
  const sub = (field as { objectFields?: Record<string, { max?: number }> } | undefined)
    ?.objectFields
  return sub?.desktop?.max ?? 160
}

/**
 * The inside of one Section settings group, in the Figma inspector's controls (369:5112,
 * 369:5133, 369:5142): width, alignment, corners and shadow as segmented switches, padding per
 * screen size behind a device switch, the colour scheme as swatch chips, and the background as
 * "Colour | Image". Anything else (and every element style group) stays Puck's own field.
 */
export default function SettingsGroupBody({
  group,
  fields,
  value,
  onChange,
  onPatch,
}: SettingsGroupBodyProps) {
  // Render logic
  const isSpacing = group === 'spacing' && 'paddingTop' in fields && 'paddingBottom' in fields
  const hasBackground =
    group === 'style' && 'backgroundColor' in fields && 'backgroundImage' in fields
  const handled = new Set<string>([
    ...(isSpacing ? ['paddingTop', 'paddingBottom'] : []),
    ...(hasBackground ? ['backgroundColor', 'backgroundImage', 'overlayOpacity'] : []),
  ])

  return (
    <div className="flex flex-col gap-4">
      {isSpacing ? (
        <SpacingField
          value={value as Parameters<typeof SpacingField>[0]['value']}
          max={maxOf(fields.paddingTop)}
          onChange={onPatch}
        />
      ) : null}
      {Object.entries(fields).map(([key, field]) => {
        if (handled.has(key)) {
          // The background control sits where the colour field was.
          if (key !== 'backgroundColor') return null
          return (
            <BackgroundField
              key={key}
              colour={typeof value.backgroundColor === 'string' ? value.backgroundColor : ''}
              image={(value.backgroundImage ?? {}) as { url?: string; alt?: string }}
              imageField={fields.backgroundImage as Field}
              overlayField={fields.overlayOpacity}
              overlay={value.overlayOpacity}
              onColour={(next) => onChange('backgroundColor', next)}
              onImage={(next) => onChange('backgroundImage', next)}
              onOverlay={(next) => onChange('overlayOpacity', next)}
            />
          )
        }
        if (group === 'advanced' && key === 'entranceAnimation' && optionsOf(field).length > 0) {
          return (
            <AnimationField
              key={key}
              label={labelOf(field, key)}
              options={optionsOf(field) as { label: string; value: string }[]}
              value={typeof value[key] === 'string' ? (value[key] as string) : 'none'}
              onChange={(next) => onChange(key, next)}
            />
          )
        }
        if (group === 'style' && key === 'colorScheme') {
          return (
            <SchemeChips
              key={key}
              label={labelOf(field, key)}
              options={optionsOf(field) as { label: string; value: string }[]}
              value={typeof value[key] === 'string' ? (value[key] as string) : ''}
              onChange={(next) => onChange(key, next)}
            />
          )
        }
        if (
          (group === 'layout' || group === 'style') &&
          SEGMENTED.has(key) &&
          optionsOf(field).length > 0
        ) {
          return (
            <SettingsSegmented
              key={key}
              label={labelOf(field, key)}
              options={optionsOf(field)}
              value={value[key] as string}
              onChange={(next) => onChange(key, next)}
            />
          )
        }
        return (
          <AutoField
            key={key}
            field={field}
            value={value[key]}
            onChange={(next: unknown) => onChange(key, next)}
          />
        )
      })}
    </div>
  )
}
