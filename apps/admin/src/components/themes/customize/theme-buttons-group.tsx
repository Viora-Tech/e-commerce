'use client'

import { schemeFor, type Theme } from '@commerce/core/theme'
import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { CORNER_RADII, type CornerStyle, cornerStyleOf } from '@/lib/theme-quick-settings'
import RangeField from '../range-field'
import SwitchField from '../switch-field'
import MoreSettings from './more-settings'
import SettingsSegmented from './settings-segmented'

type ThemeButtonsGroupProps = {
  theme: Theme
  mode: 'light' | 'dark'
  onChange: (next: Theme) => void
}

const CORNERS: CornerStyle[] = ['square', 'soft', 'round']

const rem = (px: number) => `${px / 16}rem`

/** Theme settings › Buttons: corners, filled or outline, a live sample, then the rest. */
export default function ThemeButtonsGroup({ theme, mode, onChange }: ThemeButtonsGroupProps) {
  // Hooks
  const copy = useCopy(customizeContent.themePanel)

  // Helpers
  const setButtons = (patch: Partial<Theme['buttons']>) =>
    onChange({ ...theme, buttons: { ...theme.buttons, ...patch } })
  const setRadius = (buttonRadius: number) =>
    onChange({ ...theme, shape: { ...theme.shape, buttonRadius } })

  // Render logic
  const scheme = schemeFor(theme, mode)
  const brandButtons = theme.buttons.colour === 'brand'
  const fill = brandButtons ? scheme.button : scheme.text
  const ink = brandButtons ? scheme.buttonText : scheme.background
  const radius = rem(theme.shape.buttonRadius)
  const letterCase = { textTransform: theme.buttons.uppercase ? 'uppercase' : 'none' } as const

  return (
    <>
      <SettingsSegmented
        label={copy.cornerRadius}
        value={cornerStyleOf(theme.shape.buttonRadius)}
        options={CORNERS.map((id) => ({ value: id, label: copy.corners[id] }))}
        onChange={(id) => setRadius(CORNER_RADII[id])}
      />
      <SettingsSegmented
        label={copy.buttonStyle}
        hideLabel
        value={theme.buttons.style}
        options={[
          { value: 'solid' as const, label: copy.styles.solid },
          { value: 'outline' as const, label: copy.styles.outline },
        ]}
        onChange={(style) => setButtons({ style })}
      />
      <div
        aria-hidden
        className="flex flex-wrap gap-2 rounded-lg border border-border p-3"
        style={{ backgroundColor: scheme.background }}
      >
        <span
          className="border px-4 py-2 text-[0.8125rem] leading-[1.1875rem] font-semibold"
          style={{
            backgroundColor: theme.buttons.style === 'outline' ? 'transparent' : fill,
            color: theme.buttons.style === 'outline' ? fill : ink,
            borderColor: fill,
            borderRadius: radius,
            ...letterCase,
          }}
        >
          {copy.sample.primary}
        </span>
        <span
          className="border px-4 py-2 text-[0.8125rem] leading-[1.1875rem] font-semibold"
          style={{ color: fill, borderColor: fill, borderRadius: radius, ...letterCase }}
        >
          {copy.sample.secondary}
        </span>
      </div>
      <MoreSettings label={copy.moreButtons}>
        <SwitchField
          label={themesContent.buttons.uppercase}
          checked={theme.buttons.uppercase}
          onChange={(uppercase) => setButtons({ uppercase })}
        />
        <RangeField
          label={themesContent.buttons.radius}
          value={theme.shape.buttonRadius}
          min={0}
          max={40}
          step={1}
          format={themesContent.units.px}
          onChange={setRadius}
        />
      </MoreSettings>
    </>
  )
}
