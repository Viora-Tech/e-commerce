'use client'

import {
  applyThemePreset,
  THEME_FONTS,
  THEME_PRESET_IDS,
  THEME_PRESETS,
  type Theme,
  type ThemePresetId,
} from '@commerce/core/theme'
import { RotateCcw } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { themesContent as copy } from '@/data/themes'

type ThemePresetsProps = {
  theme: Theme
  onChange: (next: Theme) => void
  /** Only the cards: the editor's Theme panel puts the heading on its row and the reset in
   * its own head. */
  bare?: boolean | undefined
  /** Four small "Aa" tiles in a row with the name under each (the editor's Theme settings,
   * Figma 697:5119). */
  compact?: boolean | undefined
}

const rem = (px: number) => `${px / 16}rem`

/** Preset cards, each drawn in its own colours, radius and heading face, plus Reset to preset. */
export default function ThemePresets({ theme, onChange, bare, compact }: ThemePresetsProps) {
  // Event handlers
  const handlePick = (id: ThemePresetId) => onChange(applyThemePreset(theme, id))
  const handleReset = () => onChange(applyThemePreset(theme, theme.preset))

  // Render logic
  const pristine = JSON.stringify(applyThemePreset(theme, theme.preset)) === JSON.stringify(theme)

  if (compact) {
    return (
      <div className="grid grid-cols-4 gap-2">
        {THEME_PRESET_IDS.map((id) => {
          const p = THEME_PRESETS[id]
          const active = theme.preset === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => handlePick(id)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'border-foreground' : 'border-border hover:border-border-strong',
              )}
            >
              <span
                className="flex h-8 w-full items-center justify-center gap-1 rounded-md text-[0.8125rem] font-semibold"
                style={{
                  backgroundColor: p.dark.background,
                  color: p.dark.text,
                  fontFamily: `"${THEME_FONTS[p.fonts.heading].label}"`,
                }}
              >
                {copy.contrast.swatch}
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: p.dark.accent }}
                />
              </span>
              <span className="text-[0.6875rem] leading-4 text-foreground">
                {copy.presets.items[id].label}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {bare ? null : (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-body font-semibold text-foreground">{copy.presets.heading}</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={pristine}
            title={copy.presets.resetHelp}
          >
            <RotateCcw aria-hidden />
            {copy.presets.reset}
          </Button>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {THEME_PRESET_IDS.map((id) => {
          const p = THEME_PRESETS[id]
          const active = theme.preset === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => handlePick(id)}
              className={cn(
                'flex flex-col overflow-hidden rounded-lg border text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'border-primary ring-1 ring-primary'
                  : 'border-border hover:shadow-card-hover',
              )}
            >
              <span
                className="flex items-center justify-between gap-2 px-3 py-3"
                style={{ backgroundColor: p.light.background, color: p.light.text }}
              >
                <span
                  className="text-lg leading-none font-semibold"
                  style={{ fontFamily: `"${THEME_FONTS[p.fonts.heading].label}"` }}
                >
                  {copy.contrast.swatch}
                </span>
                <span className="flex items-center gap-1">
                  <span
                    className="h-4 w-7"
                    style={{
                      backgroundColor: p.buttons.colour === 'brand' ? p.light.button : p.light.text,
                      borderRadius: rem(Math.min(p.shape.buttonRadius, 8)),
                    }}
                  />
                  <span
                    className="size-4 rounded-full border"
                    style={{ backgroundColor: p.shared.sale, borderColor: p.light.line }}
                  />
                </span>
              </span>
              <span className="flex flex-col gap-0.5 border-t border-border bg-card px-3 py-2">
                <span className="text-body font-semibold text-foreground">
                  {copy.presets.items[id].label}
                </span>
                <span className="text-caption text-muted-foreground">
                  {copy.presets.items[id].body}
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
