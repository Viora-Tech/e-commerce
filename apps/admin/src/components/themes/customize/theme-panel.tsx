'use client'

import { applyThemePreset, type Theme } from '@commerce/core/theme'
import {
  Braces,
  ChevronLeftIcon,
  ChevronRight,
  CreditCard,
  ExternalLink,
  FieldText,
  FieldToggle,
  Globe,
  type IconComponent,
  InfoIcon,
  LayoutGrid,
  Package,
  Palette,
  ShoppingCart,
  SocialMedia,
} from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'
import { CHROME_FOCUS } from '@/lib/customize-chrome'
import { routes } from '@/lib/routes'
import { THEME_GROUPS, type ThemeGroup, themeGroupSummary } from '@/lib/theme-panel-summary'
import BrandSettings from '../brand-settings'
import CardSettings from '../card-settings'
import CartSettings from '../cart-settings'
import CustomCssSettings from '../custom-css-settings'
import LayoutSettings from '../layout-settings'
import SocialSettings from '../social-settings'
import ThemePresets from '../theme-presets'
import PanelTitle from './panel-title'
import SettingsSegmented from './settings-segmented'
import ThemeButtonsGroup from './theme-buttons-group'
import ThemeColoursGroup from './theme-colours-group'
import ThemeTypeGroup from './theme-type-group'

type ThemePanelProps = {
  theme: Theme
  /** Which mode's colours the swatches edit; follows the canvas's light/dark switch. */
  mode: 'light' | 'dark'
  onChange: (next: Theme) => void
  /** The Scheme switch; it also flips the canvas. Left out, the switch is not shown. */
  onMode?: ((mode: 'light' | 'dark') => void) | undefined
}

const ICONS: Record<ThemeGroup, IconComponent> = {
  colours: Palette,
  typography: FieldText,
  buttons: FieldToggle,
  layout: LayoutGrid,
  cards: Package,
  cart: ShoppingCart,
  social: SocialMedia,
  css: Braces,
  brand: Globe,
}

const ROW = `flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted/60 ${CHROME_FOCUS}`
const ROW_TITLE = 'truncate text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground'
const ROW_SUMMARY = 'truncate text-xs leading-[1.0625rem] text-muted-foreground'

/**
 * The editor's Theme settings panel (Figma 697:5119): the preset (four tiles and Reset to
 * preset) and the scheme on top, then one row per group with what it is set to now; a row
 * opens its group in place with a way back (Figma 697:5479). Picking a preset restyles the
 * preview at once and offers Undo, which brings back the colours and fonts it replaced
 * (Figma 697:6170).
 */
export default function ThemePanel({ theme, mode, onChange, onMode }: ThemePanelProps) {
  // Hooks
  const copy = useCopy(customizeContent.themePanel)
  const panels = useCopy(customizeContent.panels)
  const labels = useCopy(themesContent)
  const [group, setGroup] = useState<ThemeGroup | null>(null)
  /** The theme as it was before the last preset was picked, for Undo. */
  const [beforePreset, setBeforePreset] = useState<Theme | null>(null)

  // Helpers
  const nameOf = (g: ThemeGroup) =>
    g === 'colours'
      ? copy.colours
      : g === 'typography'
        ? copy.typography
        : g === 'buttons'
          ? copy.buttons
          : copy.rows[g]

  // Event handlers
  const handlePreset = (next: Theme) => {
    setBeforePreset(theme)
    onChange(next)
  }

  const handleUndoPreset = () => {
    if (beforePreset) onChange(beforePreset)
    setBeforePreset(null)
  }

  const handleReset = () => {
    setBeforePreset(null)
    onChange(applyThemePreset(theme, theme.preset))
  }

  // Early returns
  if (group) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex flex-col gap-1 px-4 pt-3 pb-4">
          <button
            type="button"
            onClick={() => setGroup(null)}
            className={`-ml-1 flex items-center gap-1 self-start rounded-md px-1 text-xs leading-[1.0625rem] text-muted-foreground hover:text-foreground ${CHROME_FOCUS}`}
          >
            <ChevronLeftIcon aria-hidden className="size-3.5" />
            {copy.back}
          </button>
          <h2 className="text-base leading-[1.4375rem] font-semibold text-foreground">
            {nameOf(group)}
          </h2>
          <p className="text-xs leading-[1.0625rem] text-muted-foreground">{copy.help[group]}</p>
        </div>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-4">
          {group === 'colours' ? (
            <ThemeColoursGroup theme={theme} mode={mode} onChange={onChange} />
          ) : group === 'typography' ? (
            <ThemeTypeGroup theme={theme} onChange={onChange} />
          ) : group === 'buttons' ? (
            <ThemeButtonsGroup theme={theme} mode={mode} onChange={onChange} />
          ) : group === 'layout' ? (
            <LayoutSettings theme={theme} onChange={onChange} />
          ) : group === 'cards' ? (
            <CardSettings theme={theme} onChange={onChange} />
          ) : group === 'cart' ? (
            <CartSettings theme={theme} onChange={onChange} />
          ) : group === 'social' ? (
            <SocialSettings theme={theme} onChange={onChange} />
          ) : group === 'css' ? (
            <CustomCssSettings theme={theme} onChange={onChange} />
          ) : (
            <BrandSettings theme={theme} onChange={onChange} />
          )}
        </div>
      </div>
    )
  }

  // Render logic
  const pristine = JSON.stringify(applyThemePreset(theme, theme.preset)) === JSON.stringify(theme)

  return (
    <>
      <PanelTitle title={panels.theme} />
      <div className="-mt-3 flex flex-col gap-4 px-4 pb-4">
        <p className="text-xs leading-[1.0625rem] text-muted-foreground">{copy.intro}</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs leading-[1.0625rem] font-medium text-foreground">
              {copy.preset}
            </h3>
            <Button
              variant="ghost"
              size="xs"
              onClick={handleReset}
              disabled={pristine}
              title={copy.resetHelp}
              className="text-muted-foreground"
            >
              {copy.reset}
            </Button>
          </div>
          <ThemePresets theme={theme} onChange={handlePreset} compact />
        </div>
        {onMode && theme.darkMode.enabled ? (
          <SettingsSegmented
            label={copy.scheme}
            value={mode}
            options={[
              { value: 'light' as const, label: copy.schemes.light },
              { value: 'dark' as const, label: copy.schemes.dark },
            ]}
            onChange={onMode}
          />
        ) : null}
        {beforePreset ? (
          <p
            role="status"
            className="flex gap-2 rounded-lg border border-info-border bg-info-soft p-3 text-xs leading-[1.0625rem] text-info"
          >
            <InfoIcon aria-hidden className="mt-px size-3.5 shrink-0" />
            <span>
              {copy.presetApplied(labels.presets.items[theme.preset].label)}{' '}
              <button
                type="button"
                onClick={handleUndoPreset}
                className={`font-semibold underline underline-offset-2 ${CHROME_FOCUS}`}
              >
                {copy.undo}
              </button>
            </span>
          </p>
        ) : null}
        <ul className="-mx-2 flex flex-col border-t border-border pt-2">
          {THEME_GROUPS.map((g) => {
            const Icon = ICONS[g]
            return (
              <li key={g}>
                <button
                  type="button"
                  onClick={() => setGroup(g)}
                  aria-label={copy.open(nameOf(g))}
                  className={ROW}
                >
                  <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={ROW_TITLE}>{nameOf(g)}</span>
                    <span className={ROW_SUMMARY}>
                      {themeGroupSummary(g, theme, copy, (r) => labels.cards.ratios[r])}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                </button>
              </li>
            )
          })}
          <li>
            <a href={routes.settings.checkout()} target="_blank" rel="noreferrer" className={ROW}>
              <CreditCard aria-hidden className="size-4 shrink-0 text-muted-foreground" />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={ROW_TITLE}>{copy.rows.checkout}</span>
                <span className={ROW_SUMMARY}>{copy.summary.checkout}</span>
              </span>
              <ExternalLink
                aria-label={copy.newTab}
                className="size-3.5 shrink-0 text-muted-foreground"
              />
            </a>
          </li>
        </ul>
      </div>
    </>
  )
}
