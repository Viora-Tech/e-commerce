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
}

const rem = (px: number) => `${px / 16}rem`

/** Preset cards, each drawn in its own colours, radius and heading face, plus Reset to preset. */
export default function ThemePresets({ theme, onChange }: ThemePresetsProps) {
  // Event handlers
  const handlePick = (id: ThemePresetId) => onChange(applyThemePreset(theme, id))
  const handleReset = () => onChange(applyThemePreset(theme, theme.preset))

  // Render logic
  const pristine = JSON.stringify(applyThemePreset(theme, theme.preset)) === JSON.stringify(theme)

  return (
    <div className="flex flex-col gap-3">
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
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
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
