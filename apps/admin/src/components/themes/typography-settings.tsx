'use client'

import { FONT_PAIRINGS, THEME_FONTS, type Theme } from '@commerce/core/theme'
import { cn } from '@commerce/ui/lib/utils'
import { themesContent as copy } from '@/data/themes'
import FontPicker from './font-picker'
import RangeField from './range-field'

type TypographySettingsProps = {
  theme: Theme
  onChange: (next: Theme) => void
}

const family = (label: string) => ({ fontFamily: `"${label}"` })

/** Pairings, heading and body faces, and the type scale. */
export default function TypographySettings({ theme, onChange }: TypographySettingsProps) {
  // Helpers
  const setFonts = (patch: Partial<Theme['fonts']>) =>
    onChange({ ...theme, fonts: { ...theme.fonts, ...patch } })

  // Render logic
  const fonts = theme.fonts

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-body text-foreground">{copy.typography.pairings}</span>
        <div className="grid grid-cols-2 gap-2">
          {FONT_PAIRINGS.map((p) => {
            const active = p.heading === fonts.heading && p.body === fonts.body
            return (
              <button
                key={p.id}
                type="button"
                aria-pressed={active}
                onClick={() => setFonts({ heading: p.heading, body: p.body })}
                className={cn(
                  'flex min-w-0 flex-col items-start gap-0.5 rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'border-primary bg-primary-soft' : 'border-border hover:bg-muted',
                )}
              >
                <span
                  className="w-full truncate text-body font-semibold text-foreground"
                  style={family(THEME_FONTS[p.heading].label)}
                >
                  {THEME_FONTS[p.heading].label}
                </span>
                <span
                  className="w-full truncate text-caption text-muted-foreground"
                  style={family(THEME_FONTS[p.body].label)}
                >
                  {THEME_FONTS[p.body].label}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <FontPicker
        label={copy.typography.heading}
        kind="heading"
        value={fonts.heading}
        onChange={(heading) => setFonts({ heading })}
      />
      <FontPicker
        label={copy.typography.body}
        kind="body"
        value={fonts.body}
        onChange={(body) => setFonts({ body })}
      />
      <RangeField
        label={copy.typography.headingScale}
        value={fonts.headingScale}
        min={0.5}
        max={2}
        step={0.05}
        format={copy.units.times}
        onChange={(headingScale) => setFonts({ headingScale })}
      />
      <RangeField
        label={copy.typography.bodySize}
        value={fonts.bodySizePx}
        min={12}
        max={22}
        step={1}
        format={copy.units.px}
        onChange={(bodySizePx) => setFonts({ bodySizePx })}
      />
      <RangeField
        label={copy.typography.tracking}
        value={fonts.headingTracking}
        min={-0.05}
        max={0.1}
        step={0.01}
        format={copy.units.em}
        onChange={(headingTracking) => setFonts({ headingTracking })}
      />
    </>
  )
}
