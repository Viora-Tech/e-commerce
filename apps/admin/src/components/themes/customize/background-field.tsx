'use client'

import { safeColour } from '@commerce/blocks/element-style'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { AutoField, type Field } from '@puckeditor/core'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { FIELD_CONTROL, SWATCH_CHIP, swatchChipState } from '@/lib/customize-field-styles'
import { useThemePreview } from '@/lib/customize-theme-context'
import SettingsSegmented from './settings-segmented'

type BackgroundFieldProps = {
  colour: string
  image: { url?: string; alt?: string }
  imageField: Field
  overlayField: Field | undefined
  overlay: unknown
  onColour: (value: string) => void
  onImage: (value: unknown) => void
  onOverlay: (value: unknown) => void
}

type Mode = 'colour' | 'image'

const copy = customizeContent.settingsControls

/** The theme colours offered first; stored by name (`SECTION_BACKGROUND_TOKENS`) or as hex. */
const TOKENS = ['ink', 'brand', 'background'] as const
const WHITE = '#ffffff'
const HEX = /^#[0-9a-f]{6}$/i

/**
 * A section's background (Figma inspector 369:5139): "Colour | Image" on a segmented switch.
 * Colour offers the theme's own colours as chips, which follow the colour scheme and dark mode,
 * plus white and a custom colour; Image is the image picker with its overlay.
 */
export default function BackgroundField({
  colour,
  image,
  imageField,
  overlayField,
  overlay,
  onColour,
  onImage,
  onOverlay,
}: BackgroundFieldProps) {
  // Hooks
  const theme = useThemePreview()
  const [mode, setMode] = useState<Mode>(image.url ? 'image' : 'colour')
  const [customOpen, setCustomOpen] = useState(
    colour !== '' && colour !== WHITE && !(TOKENS as readonly string[]).includes(colour),
  )

  // Render logic
  const scheme = theme?.schemes.find((s) => s.id === theme.lightScheme) ?? theme?.schemes[0]
  const swatch: Record<string, string | undefined> = {
    ink: scheme?.text,
    brand: scheme?.button,
    background: scheme?.background,
    [WHITE]: WHITE,
  }
  const chips = [
    { value: '', label: copy.noBackground },
    ...TOKENS.map((t) => ({ value: t, label: copy.backgroundTokens[t] })),
    { value: WHITE, label: copy.backgroundTokens.white },
  ]
  const valid = safeColour(colour)
  const chosen = chips.find((c) => c.value === colour)
  const hex = swatch[colour] ?? (valid && HEX.test(valid) ? valid : undefined)
  const currentLabel =
    colour === ''
      ? copy.currentNone
      : [chosen?.label ?? copy.custom, hex?.toUpperCase()].filter(Boolean).join(' · ')

  return (
    <div className="flex flex-col gap-2">
      <SettingsSegmented
        label={copy.background}
        options={[
          { value: 'colour' as const, label: copy.backgroundColour },
          { value: 'image' as const, label: copy.backgroundImage },
        ]}
        value={mode}
        onChange={setMode}
        fill={false}
      />
      {mode === 'colour' ? (
        <div className="flex flex-col gap-2">
          <div
            role="radiogroup"
            aria-label={copy.backgroundColour}
            className="flex flex-wrap gap-1.5"
          >
            {chips.map((c) => {
              const checked = !customOpen && colour === c.value
              return (
                // biome-ignore lint/a11y/useSemanticElements: a styled chip or segment in a radio group; a native radio input cannot carry this look.
                <button
                  key={c.value || 'none'}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => {
                    setCustomOpen(false)
                    onColour(c.value)
                  }}
                  className={cn(SWATCH_CHIP, swatchChipState(checked))}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-4 shrink-0 rounded-full ring-1 ring-border ring-inset',
                      // "None": a struck-through empty swatch.
                      c.value === '' &&
                        'bg-[linear-gradient(135deg,transparent_45%,var(--border)_45%,var(--border)_55%,transparent_55%)]',
                    )}
                    style={
                      c.value && swatch[c.value] ? { backgroundColor: swatch[c.value] } : undefined
                    }
                  />
                  {c.label}
                </button>
              )
            })}
            {/* biome-ignore lint/a11y/useSemanticElements: a styled chip or segment in a radio group; a native radio input cannot carry this look. */}
            <button
              type="button"
              role="radio"
              aria-checked={customOpen}
              onClick={() => setCustomOpen(true)}
              className={cn(SWATCH_CHIP, swatchChipState(customOpen))}
            >
              <span
                aria-hidden
                className="size-4 shrink-0 rounded-full bg-[conic-gradient(from_0deg,var(--chart-1),var(--chart-2),var(--chart-3),var(--chart-4),var(--chart-1))] ring-1 ring-border ring-inset"
              />
              {copy.custom}
            </button>
          </div>
          {customOpen ? (
            <div className="relative">
              {/* The swatch is the browser's colour picker; typing a value works too. */}
              <input
                type="color"
                value={valid && HEX.test(valid) ? valid : WHITE}
                onChange={(e) => onColour(e.target.value)}
                aria-label={`${copy.backgroundColour}, ${copy.custom}`}
                className="absolute top-1/2 left-1.5 size-5 -translate-y-1/2 cursor-pointer rounded-sm border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-sm [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0"
              />
              <Input
                value={(TOKENS as readonly string[]).includes(colour) ? '' : colour}
                onChange={(e) => onColour(e.target.value)}
                placeholder={copy.customPlaceholder}
                aria-label={`${copy.backgroundColour}, ${copy.custom}`}
                aria-invalid={
                  colour !== '' && !valid && !(TOKENS as readonly string[]).includes(colour)
                }
                size="lg"
                className={cn(FIELD_CONTROL, 'pl-8 font-mono text-xs')}
              />
            </div>
          ) : null}
          <p className="flex items-center justify-between text-[0.8125rem] leading-[1.1875rem]">
            <span className="text-muted-foreground">{copy.current}</span>
            <span className="text-foreground tabular-nums">{currentLabel}</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <AutoField field={imageField} value={image} onChange={onImage} />
          {overlayField && image.url ? (
            <AutoField field={overlayField} value={overlay} onChange={onOverlay} />
          ) : null}
        </div>
      )}
    </div>
  )
}
