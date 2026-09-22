'use client'

import {
  type ColorScheme,
  type StatusColors,
  type Theme,
  themeContrastWarnings,
} from '@commerce/core/theme'
import { themesContent as copy } from '@/data/themes'
import ChoiceField from './choice-field'
import ColourField from './colour-field'
import ContrastWarnings from './contrast-warnings'
import SwitchField from './switch-field'

type ColourSettingsProps = {
  theme: Theme
  /** Which mode's colours the fields edit; follows the preview's light/dark toggle. */
  mode: 'light' | 'dark'
  onChange: (next: Theme) => void
}

type Role = Exclude<keyof ColorScheme, 'id' | 'name'>

const ROLES: Role[] = [
  'background',
  'text',
  'textMuted',
  'line',
  'surface',
  'button',
  'buttonText',
  'accent',
]
const STATUS: (keyof StatusColors)[] = ['success', 'danger', 'sale']
const DARK_DEFAULTS = (['system', 'light', 'dark'] as const).map((value) => ({
  value,
  label: copy.colours.darkDefaults[value],
}))

const schemeOf = (theme: Theme, mode: 'light' | 'dark') => {
  const id = mode === 'light' ? theme.lightScheme : theme.darkScheme
  return theme.schemes.find((s) => s.id === id) ?? theme.schemes[0]
}

const statusOf = (theme: Theme, mode: 'light' | 'dark') =>
  mode === 'light' ? theme.shared : theme.sharedDark

/** Page colours for the mode being previewed, status colours, dark mode and AA warnings. */
export default function ColourSettings({ theme, mode, onChange }: ColourSettingsProps) {
  // Event handlers
  const handleRole = (role: Role, hex: string) => {
    const id = schemeOf(theme, mode)?.id
    onChange({
      ...theme,
      schemes: theme.schemes.map((s) => (s.id === id ? { ...s, [role]: hex } : s)),
    })
  }

  const handleStatus = (key: keyof StatusColors, hex: string) => {
    const next = { ...statusOf(theme, mode), [key]: hex }
    onChange(mode === 'light' ? { ...theme, shared: next } : { ...theme, sharedDark: next })
  }

  // Early returns
  const scheme = schemeOf(theme, mode)
  if (!scheme) return null

  // Render logic
  const status = statusOf(theme, mode)
  const warnings = themeContrastWarnings(theme)

  return (
    <>
      <p className="text-caption text-muted-foreground">{copy.colours.editing(mode)}</p>
      {ROLES.map((role) => (
        <ColourField
          key={role}
          label={copy.colours.roles[role]}
          value={scheme[role]}
          onChange={(hex) => handleRole(role, hex)}
        />
      ))}
      <div className="flex flex-col gap-4 border-t border-border pt-4">
        {STATUS.map((key) => (
          <ColourField
            key={key}
            label={copy.colours.status[key]}
            value={status[key]}
            onChange={(hex) => handleStatus(key, hex)}
          />
        ))}
      </div>
      <ContrastWarnings warnings={warnings} />
      <div className="flex flex-col gap-4 border-t border-border pt-4">
        <SwitchField
          label={copy.colours.darkMode}
          help={copy.colours.darkModeHelp}
          checked={theme.darkMode.enabled}
          onChange={(enabled) => onChange({ ...theme, darkMode: { ...theme.darkMode, enabled } })}
        />
        {theme.darkMode.enabled ? (
          <ChoiceField
            label={copy.colours.darkDefault}
            value={theme.darkMode.default}
            options={DARK_DEFAULTS}
            onChange={(value) =>
              onChange({ ...theme, darkMode: { ...theme.darkMode, default: value } })
            }
          />
        ) : null}
      </div>
    </>
  )
}
