'use client'

import { Settings as GearIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { Switch } from '@commerce/ui/shadcn/switch'
import type { ReactNode } from 'react'
import { useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import { globeSettingsContent as copy } from '@/data/live-globe'
import { readPalette } from './globe-palette'
import type {
  GlobeLayerSettings,
  GlobeLookSettings,
  GlobeMotionSettings,
  GlobeSettings,
  GlobeThemePreset,
} from './globe-settings'

type GlobeSettingsPanelProps = {
  settings: GlobeSettings
  /** For the colour pickers' "theme colour" swatches, which differ between light and dark. */
  dark: boolean
  onChange: (patch: Partial<GlobeSettings>) => void
  onReset: () => void
}

type Tab = keyof typeof copy.tabs

const TABS: readonly Tab[] = ['look', 'layers', 'data', 'palette']
const LAYER_KEYS = ['borders', 'coastlines', 'grid', 'arcs', 'glow'] as const
const MOTION_SPEEDS = ['slow', 'normal', 'fast'] as const
const START_VIEWS = ['india', 'mine', 'world'] as const
const STYLES = ['solid', 'dotted'] as const
const DOT_SIZES = ['fine', 'medium', 'bold'] as const
const THEMES = ['accent', 'night', 'ocean', 'mono'] as const
const TIME_RANGES = ['1h', '24h', '7d'] as const

/** A segmented control that fills the panel's width, its options sharing it evenly, so longer
 * labels ("Whole world") never run past the edge. */
const FULL_WIDTH_SEGMENTED =
  'flex w-full [&>button]:min-w-0 [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2'

/** Small preview swatches for each theme preset's chip (its land colour is enough to tell them
 * apart at a glance; "Store accent" shows the accent token itself). */
const THEME_SWATCH: Record<Exclude<GlobeThemePreset, 'accent'>, string> = {
  night: '#293548',
  ocean: '#3a6b66',
  mono: '#808080',
}

/**
 * The gear button next to the zoom controls: a popover anchored to it with every Live view
 * globe setting, split into Look / Layers / Data / Palette tabs so each fits without crowding.
 * A fixed-height panel (header, tabs, a body that scrolls on its own, and a Reset footer that
 * is always in reach). Changes apply instantly (the canvas reads them as uniforms each frame,
 * never rebuilding the WebGL context) and are saved to this browser only.
 */
export default function GlobeSettingsPanel({
  settings,
  dark,
  onChange,
  onReset,
}: GlobeSettingsPanelProps) {
  // Hooks
  const [tab, setTab] = useState<Tab>('look')

  // Helpers
  const setLayer = (key: keyof GlobeLayerSettings, value: boolean) =>
    onChange({ layers: { ...settings.layers, [key]: value } })
  const setMotion = <K extends keyof GlobeMotionSettings>(key: K, value: GlobeMotionSettings[K]) =>
    onChange({ motion: { ...settings.motion, [key]: value } })
  const setLook = <K extends keyof GlobeLookSettings>(key: K, value: GlobeLookSettings[K]) =>
    onChange({ look: { ...settings.look, [key]: value } })
  const setData = (patch: Partial<GlobeSettings['data']>) =>
    onChange({ data: { ...settings.data, ...patch } })

  // Render logic
  /* The theme's own colours, as drawn (custom picks left out), for the pickers to start from. */
  const themeSwatches = readPalette(
    dark,
    {
      theme: settings.look.theme,
      customLand: null,
      customOcean: null,
      customAccent: null,
      customBorder: null,
    },
    true,
  ).swatches

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            aria-label={copy.openSettings}
          >
            <GearIcon className="size-4" />
          </Button>
        }
      />
      {/* bg-popover/95 + blur, not a fully opaque panel: in Chrome on Windows an opaque layer
          over the WebGL canvas makes the compositor stop drawing the canvas beside and below it
          (a white block over the globe). A barely see-through panel avoids that. */}
      <PopoverContent
        align="end"
        sideOffset={8}
        className="h-[min(34rem,calc(var(--available-height,34rem)-0.75rem))] w-[22rem] max-w-[calc(100vw-1.5rem)] gap-0 overflow-hidden bg-popover p-0"
      >
        <div className="flex shrink-0 flex-col gap-3 px-4 pt-4 pb-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-body font-medium text-popover-foreground">{copy.title}</p>
            <p className="text-caption text-muted-foreground">{copy.subtitle}</p>
          </div>
          <PillTabs
            variant="segmented"
            className={FULL_WIDTH_SEGMENTED}
            tabs={TABS.map((t) => ({ value: t, label: copy.tabs[t] }))}
            value={tab}
            onChange={setTab}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain border-t border-border px-4 py-4">
          {tab === 'look' ? (
            <>
              <Group>
                <Field label={copy.look.style}>
                  <PillTabs
                    variant="segmented"
                    className={FULL_WIDTH_SEGMENTED}
                    tabs={STYLES.map((s) => ({ value: s, label: copy.look.styles[s] }))}
                    value={settings.look.style}
                    onChange={(v) => setLook('style', v)}
                  />
                </Field>
                <Field
                  label={copy.look.dotSize}
                  help={settings.look.style === 'dotted' ? undefined : copy.look.dotSizeOff}
                >
                  <PillTabs
                    variant="segmented"
                    className={FULL_WIDTH_SEGMENTED}
                    tabs={DOT_SIZES.map((s) => ({ value: s, label: copy.look.dotSizes[s] }))}
                    value={settings.look.dotSize}
                    onChange={(v) => setLook('dotSize', v)}
                  />
                </Field>
                <Field
                  label={copy.look.borderStyle}
                  help={settings.layers.borders ? undefined : copy.look.borderStyleOff}
                >
                  <PillTabs
                    variant="segmented"
                    className={FULL_WIDTH_SEGMENTED}
                    tabs={STYLES.map((s) => ({ value: s, label: copy.look.borderStyles[s] }))}
                    value={settings.look.borderStyle}
                    onChange={(v) => setLook('borderStyle', v)}
                  />
                </Field>
              </Group>
              <Group heading={copy.motion.heading}>
                <SwitchRow
                  label={copy.motion.autoRotate}
                  checked={settings.motion.autoRotate}
                  onChange={(v) => setMotion('autoRotate', v)}
                />
                <Field label={copy.motion.speed}>
                  <PillTabs
                    variant="segmented"
                    className={FULL_WIDTH_SEGMENTED}
                    tabs={MOTION_SPEEDS.map((s) => ({ value: s, label: copy.motion.speeds[s] }))}
                    value={settings.motion.speed}
                    onChange={(v) => setMotion('speed', v)}
                  />
                </Field>
                <Field label={copy.motion.startView}>
                  <PillTabs
                    variant="segmented"
                    className={FULL_WIDTH_SEGMENTED}
                    tabs={START_VIEWS.map((s) => ({ value: s, label: copy.motion.startViews[s] }))}
                    value={settings.motion.startView}
                    onChange={(v) => setMotion('startView', v)}
                  />
                </Field>
                <SwitchRow
                  label={copy.motion.rememberZoom}
                  checked={settings.motion.rememberZoom}
                  onChange={(v) => setMotion('rememberZoom', v)}
                />
              </Group>
            </>
          ) : null}

          {tab === 'layers' ? (
            <Group>
              {LAYER_KEYS.map((key) => (
                <SwitchRow
                  key={key}
                  label={copy.layers[key]}
                  checked={settings.layers[key]}
                  onChange={(v) => setLayer(key, v)}
                />
              ))}
            </Group>
          ) : null}

          {tab === 'data' ? (
            <Group>
              <Field label={copy.data.timeRange}>
                <PillTabs
                  variant="segmented"
                  className={FULL_WIDTH_SEGMENTED}
                  tabs={TIME_RANGES.map((r) => ({ value: r, label: copy.data.timeRanges[r] }))}
                  value={settings.data.timeRange}
                  onChange={(v) => setData({ timeRange: v })}
                />
              </Field>
              <SwitchRow
                label={copy.data.highlightBigOrders}
                help={copy.data.highlightBigOrdersHelp}
                checked={settings.data.highlightBigOrders}
                onChange={(v) => setData({ highlightBigOrders: v })}
              />
              <SwitchRow
                label={copy.data.dayNightShadow}
                help={copy.data.dayNightShadowHelp}
                checked={settings.data.dayNightShadow}
                onChange={(v) => setData({ dayNightShadow: v })}
              />
              <p className="rounded-md bg-muted px-3 py-2 text-caption leading-relaxed text-muted-foreground">
                {copy.data.visitorsUnavailable}
              </p>
            </Group>
          ) : null}

          {tab === 'palette' ? (
            <>
              <Group heading={copy.look.theme}>
                <div className="grid grid-cols-2 gap-1.5">
                  {THEMES.map((t) => (
                    <ThemeChip
                      key={t}
                      theme={t}
                      active={settings.look.theme === t}
                      label={copy.look.themes[t]}
                      onClick={() => setLook('theme', t)}
                    />
                  ))}
                </div>
              </Group>
              <Group>
                <ColorRow
                  label={copy.look.customLand}
                  value={settings.look.customLand}
                  fallback={themeSwatches.land}
                  onChange={(v) => setLook('customLand', v)}
                />
                <ColorRow
                  label={copy.look.customOcean}
                  value={settings.look.customOcean}
                  fallback={themeSwatches.ocean}
                  onChange={(v) => setLook('customOcean', v)}
                />
                <ColorRow
                  label={copy.look.customAccent}
                  value={settings.look.customAccent}
                  fallback={themeSwatches.accent}
                  onChange={(v) => setLook('customAccent', v)}
                />
                <ColorRow
                  label={copy.look.customBorder}
                  value={settings.look.customBorder}
                  fallback={themeSwatches.border}
                  onChange={(v) => setLook('customBorder', v)}
                />
              </Group>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end border-t border-border px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={onReset}
          >
            {copy.reset}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

type GroupProps = { heading?: string; children: ReactNode }

/** A run of settings, optionally under a small eyebrow heading. */
function Group({ heading, children }: GroupProps) {
  return (
    <section className="flex flex-col gap-3">
      {heading ? <p className="text-eyebrow">{heading}</p> : null}
      {children}
    </section>
  )
}

type FieldProps = { label: string; help?: string; children: ReactNode }

/** A label with its (full-width) control on its own line below, and an optional help line. */
function Field({ label, help, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption text-muted-foreground">{label}</span>
      {children}
      {help ? (
        <span className="text-caption leading-snug text-muted-foreground">{help}</span>
      ) : null}
    </div>
  )
}

type LabelRowProps = { label: string; help?: string; children: ReactNode }

/** A label (and an optional help line wrapping under it) with its control on the right. */
function LabelRow({ label, help, children }: LabelRowProps) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-body leading-snug text-foreground">{label}</span>
        {help ? (
          <span className="text-caption leading-snug text-muted-foreground">{help}</span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center">{children}</div>
    </div>
  )
}

type SwitchRowProps = {
  label: string
  help?: string
  checked: boolean
  onChange: (value: boolean) => void
}

function SwitchRow({ label, help, checked, onChange }: SwitchRowProps) {
  return (
    <LabelRow label={label} help={help}>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </LabelRow>
  )
}

type ThemeChipProps = {
  theme: GlobeThemePreset
  label: string
  active: boolean
  onClick: () => void
}

/** One theme preset as a small round swatch plus its name; "Store accent" shows the accent
 * token itself, the rest a fixed preview colour. */
function ThemeChip({ theme, label, active, onClick }: ThemeChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-9 min-w-0 items-center gap-2 rounded-md border px-2.5 text-caption transition-[color,background-color,border-color] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        active
          ? 'border-ring bg-secondary text-ink-strong'
          : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      <span
        aria-hidden
        className={cn('size-3 shrink-0 rounded-full', theme === 'accent' && 'bg-primary')}
        style={theme === 'accent' ? undefined : { backgroundColor: THEME_SWATCH[theme] }}
      />
      <span className="truncate">{label}</span>
    </button>
  )
}

type ColorRowProps = {
  label: string
  value: string | null
  fallback: string
  onChange: (hex: string | null) => void
}

/** A colour picker row: a round swatch (the native colour input, styled circular) plus "use
 * theme colour" once an override is picked. */
function ColorRow({ label, value, fallback, onChange }: ColorRowProps) {
  return (
    <LabelRow label={label}>
      <div className="flex items-center gap-2">
        {value ? (
          <button
            type="button"
            className="text-caption text-muted-foreground underline underline-offset-2 hover:text-foreground"
            onClick={() => onChange(null)}
          >
            {copy.look.useTheme}
          </button>
        ) : null}
        <input
          type="color"
          aria-label={label}
          value={value ?? fallback}
          onChange={(e) => onChange(e.target.value)}
          className="size-7 cursor-pointer rounded-full border border-border bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:rounded-full [&::-webkit-color-swatch-wrapper]:p-0"
        />
      </div>
    </LabelRow>
  )
}
