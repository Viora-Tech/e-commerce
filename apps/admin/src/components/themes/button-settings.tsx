'use client'

import { schemeFor, type Theme } from '@commerce/core/theme'
import { themesContent as copy } from '@/data/themes'
import ChoiceField from './choice-field'
import RangeField from './range-field'
import SwitchField from './switch-field'

type ButtonSettingsProps = {
  theme: Theme
  mode: 'light' | 'dark'
  onChange: (next: Theme) => void
}

const STYLES = (['solid', 'outline'] as const).map((value) => ({
  value,
  label: copy.buttons.styles[value],
}))
const COLOURS = (['text', 'brand'] as const).map((value) => ({
  value,
  label: copy.buttons.colours[value],
}))

const rem = (px: number) => `${px / 16}rem`

/** Style, colour source, label case and radius of the primary button. */
export default function ButtonSettings({ theme, mode, onChange }: ButtonSettingsProps) {
  // Helpers
  const setButtons = (patch: Partial<Theme['buttons']>) =>
    onChange({ ...theme, buttons: { ...theme.buttons, ...patch } })

  // Render logic
  const buttons = theme.buttons
  const s = schemeFor(theme, mode)
  const fill = buttons.colour === 'brand' ? s.button : s.text
  const ink = buttons.colour === 'brand' ? s.buttonText : s.background
  const outline = buttons.style === 'outline'

  return (
    <>
      <div
        className="flex items-center justify-center rounded-md border border-border px-4 py-5"
        style={{ backgroundColor: s.background }}
      >
        <span
          className="px-5 py-2.5 text-sm font-semibold"
          style={{
            backgroundColor: outline ? 'transparent' : fill,
            color: outline ? fill : ink,
            border: `${rem(Math.max(theme.shape.borderWidth, 1))} solid ${fill}`,
            borderRadius: rem(theme.shape.buttonRadius),
            textTransform: buttons.uppercase ? 'uppercase' : 'none',
          }}
        >
          {copy.buttons.preview}
        </span>
      </div>
      <ChoiceField
        label={copy.buttons.style}
        value={buttons.style}
        options={STYLES}
        onChange={(style) => setButtons({ style })}
      />
      <ChoiceField
        label={copy.buttons.colour}
        value={buttons.colour}
        options={COLOURS}
        onChange={(colour) => setButtons({ colour })}
      />
      <SwitchField
        label={copy.buttons.uppercase}
        checked={buttons.uppercase}
        onChange={(uppercase) => setButtons({ uppercase })}
      />
      <RangeField
        label={copy.buttons.radius}
        value={theme.shape.buttonRadius}
        min={0}
        max={40}
        step={1}
        format={copy.units.px}
        onChange={(buttonRadius) => onChange({ ...theme, shape: { ...theme.shape, buttonRadius } })}
      />
    </>
  )
}
