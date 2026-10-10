'use client'

import { applyThemePreset, schemeFor, type Theme } from '@commerce/core/theme'
import { ExternalLink, RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import { routes } from '@/lib/routes'
import {
  CORNER_RADII,
  type CornerStyle,
  cornerStyleOf,
  SIZE_SCALES,
  type SizeScale,
  sizeScaleOf,
} from '@/lib/theme-quick-settings'
import BrandSettings from '../brand-settings'
import CardSettings from '../card-settings'
import ColourSettings, { type ColourRole } from '../colour-settings'
import FontPicker from '../font-picker'
import LayoutSettings from '../layout-settings'
import RangeField from '../range-field'
import SwitchField from '../switch-field'
import ThemePresets from '../theme-presets'
import TypographySettings from '../typography-settings'
import MoreSettings from './more-settings'
import PanelTitle from './panel-title'
import SettingsSegmented from './settings-segmented'
import SwatchRow from './swatch-row'
import ThemePanelSection from './theme-panel-section'

type ThemePanelProps = {
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

const SIZES: SizeScale[] = ['s', 'm', 'l']
const CORNERS: CornerStyle[] = ['square', 'soft', 'round']

const rem = (px: number) => `${px / 16}rem`

/**
 * The editor's Theme settings panel (Figma 369:121884): the reset in its head; Colours as five
 * swatches (Brand, Accent, Background, Text, Buttons); Typography as two font dropdowns and a
 * size choice; Buttons as corners, filled or outline and a live sample; then closed rows for
 * Presets, Logo & favicon, Layout, Product cards and Checkout branding. Each group's exact
 * controls sit behind "All colours" / "More … settings", so nothing the theme does is lost.
 */
export default function ThemePanel({ theme, mode, onChange }: ThemePanelProps) {
  // Hooks
  const copy = useCopy(customizeContent.themePanel)
  const panels = useCopy(customizeContent.panels)

  // Helpers
  const setRole = (role: ColourRole, hex: string) => {
    const id = schemeFor(theme, mode).id
    onChange({
      ...theme,
      schemes: theme.schemes.map((s) => (s.id === id ? { ...s, [role]: hex } : s)),
    })
  }
  const setButtons = (patch: Partial<Theme['buttons']>) =>
    onChange({ ...theme, buttons: { ...theme.buttons, ...patch } })
  const setRadius = (buttonRadius: number) =>
    onChange({ ...theme, shape: { ...theme.shape, buttonRadius } })

  // Event handlers
  const handleReset = () => onChange(applyThemePreset(theme, theme.preset))

  // Render logic
  const scheme = schemeFor(theme, mode)
  const pristine = JSON.stringify(applyThemePreset(theme, theme.preset)) === JSON.stringify(theme)
  const brandButtons = theme.buttons.colour === 'brand'
  const fill = brandButtons ? scheme.button : scheme.text
  const ink = brandButtons ? scheme.buttonText : scheme.background
  const radius = rem(theme.shape.buttonRadius)
  const letterCase = { textTransform: theme.buttons.uppercase ? 'uppercase' : 'none' } as const

  return (
    <>
      <PanelTitle
        title={panels.theme}
        action={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleReset}
            disabled={pristine}
            aria-label={copy.reset}
            title={copy.resetHelp}
            className="text-muted-foreground"
          >
            <RotateCcw aria-hidden className="size-3.5" />
          </Button>
        }
      />
      <div className="flex flex-col gap-4 px-4 pb-4">
        <ThemePanelSection title={copy.colours} defaultOpen>
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
                onChange={(colour) => setButtons({ colour })}
              />
            </PopoverContent>
          </Popover>
          <MoreSettings label={copy.allColours}>
            <ColourSettings theme={theme} mode={mode} onChange={onChange} roles={OTHER_ROLES} />
          </MoreSettings>
        </ThemePanelSection>

        <ThemePanelSection title={copy.typography} defaultOpen>
          <FontPicker
            compact
            label={copy.headingFont}
            kind="heading"
            value={theme.fonts.heading}
            onChange={(heading) => onChange({ ...theme, fonts: { ...theme.fonts, heading } })}
          />
          <FontPicker
            compact
            label={copy.bodyFont}
            kind="body"
            value={theme.fonts.body}
            onChange={(body) => onChange({ ...theme, fonts: { ...theme.fonts, body } })}
          />
          <SettingsSegmented
            label={copy.sizeScale}
            value={sizeScaleOf(theme.fonts)}
            options={SIZES.map((id) => ({ value: id, label: copy.sizes[id] }))}
            onChange={(id) => onChange({ ...theme, fonts: { ...theme.fonts, ...SIZE_SCALES[id] } })}
          />
          <MoreSettings label={copy.moreType}>
            <TypographySettings theme={theme} onChange={onChange} pickers={false} />
          </MoreSettings>
        </ThemePanelSection>

        <ThemePanelSection title={copy.buttons} defaultOpen>
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
        </ThemePanelSection>

        <ThemePanelSection title={copy.rows.presets}>
          <ThemePresets theme={theme} onChange={onChange} bare />
        </ThemePanelSection>
        <ThemePanelSection title={copy.rows.brand}>
          <BrandSettings theme={theme} onChange={onChange} />
        </ThemePanelSection>
        <ThemePanelSection title={copy.rows.layout}>
          <LayoutSettings theme={theme} onChange={onChange} />
        </ThemePanelSection>
        <ThemePanelSection title={copy.rows.cards}>
          <CardSettings theme={theme} onChange={onChange} />
        </ThemePanelSection>
        <a
          href={routes.settings.checkout()}
          target="_blank"
          rel="noreferrer"
          className={`flex min-h-8 items-center gap-2 border-b border-border pb-3 text-sm leading-5 font-semibold text-foreground hover:text-link ${CHROME_FOCUS}`}
        >
          <span className="min-w-0 flex-1 truncate">{copy.rows.checkout}</span>
          <ExternalLink
            aria-label={copy.newTab}
            className="size-3.5 shrink-0 text-muted-foreground"
          />
        </a>
      </div>
    </>
  )
}
