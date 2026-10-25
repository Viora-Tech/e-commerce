'use client'

import { schemeFor, type Theme } from '@commerce/core/theme'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { customizeContent } from '@/data/customize'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import ColourSettings, { type ColourRole } from '../colour-settings'
import MoreSettings from './more-settings'
import SettingsSegmented from './settings-segmented'
import SwatchRow from './swatch-row'

type ThemeColoursGroupProps = {
  theme: Theme
  /** Which mode's colours the swatches edit; follows the canvas's light/dark switch. */
  mode: 'light' | 'dark'
  onChange: (next: Theme) => void
}

/** The four page colours shown as swatches, in Figma's order; Buttons follows them. */
const SWATCHES: { role: ColourRole; key: 'brand' | 'accent' | 'background' | 'text' }[] = [
  { role: 'button', key: 'brand' },
  { role: 'accent', key: 'accent' },
  { role: 'background', key: 'background' },
  { role: 'text', key: 'text' },
]

/** The colours "All colours" lists: every page colour the swatches don't show. */
const OTHER_ROLES: ColourRole[] = ['textMuted', 'line', 'surface', 'buttonText']

/** Theme settings › Colours: five swatches (Brand, Accent, Background, Text, Buttons), then all. */
export default function ThemeColoursGroup({ theme, mode, onChange }: ThemeColoursGroupProps) {
  // Hooks
  const copy = useCopy(customizeContent.themePanel)

  // Helpers
  const setRole = (role: ColourRole, hex: string) => {
    const id = schemeFor(theme, mode).id
    onChange({
      ...theme,
      schemes: theme.schemes.map((s) => (s.id === id ? { ...s, [role]: hex } : s)),
    })
  }

  // Render logic
  const scheme = schemeFor(theme, mode)
  const fill = theme.buttons.colour === 'brand' ? scheme.button : scheme.text

  return (
    <>
      {SWATCHES.map(({ role, key }) => (
        <SwatchRow
          key={role}
          label={copy.swatches[key]}
          value={scheme[role]}
          onChange={(hex) => setRole(role, hex)}
        />
      ))}
      <Popover>
        <PopoverTrigger
          className={`flex items-center gap-2.5 rounded-lg text-left hover:bg-muted/60 ${CHROME_FOCUS}`}
        >
          <span
            aria-hidden
            className="size-7 shrink-0 rounded-[0.5rem] border border-border"
            style={{ backgroundColor: fill }}
          />
          <span className="min-w-0 flex-1 truncate text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground">
            {copy.swatches.buttons}
          </span>
          <span className="px-1.5 text-xs leading-[1.0625rem] text-muted-foreground uppercase tabular-nums">
            {fill}
          </span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64">
          <SettingsSegmented
            label={copy.buttonColour}
            value={theme.buttons.colour}
            options={[
              { value: 'text' as const, label: copy.buttonColours.text },
              { value: 'brand' as const, label: copy.buttonColours.brand },
            ]}
            onChange={(colour) => onChange({ ...theme, buttons: { ...theme.buttons, colour } })}
          />
        </PopoverContent>
      </Popover>
      <MoreSettings label={copy.allColours}>
        <ColourSettings theme={theme} mode={mode} onChange={onChange} roles={OTHER_ROLES} />
      </MoreSettings>
    </>
  )
}
