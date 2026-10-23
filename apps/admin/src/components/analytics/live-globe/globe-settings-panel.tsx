'use client'

import { Settings as GearIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Label } from '@commerce/ui/shadcn/label'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { Switch } from '@commerce/ui/shadcn/switch'
import type { ReactNode } from 'react'
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

const LAYER_KEYS = ['borders', 'coastlines', 'grid', 'arcs', 'glow'] as const
const MOTION_SPEEDS = ['slow', 'normal', 'fast'] as const
const START_VIEWS = ['india', 'mine', 'world'] as const
const STYLES = ['solid', 'dotted'] as const
const THEMES = ['accent', 'night', 'ocean', 'mono'] as const
const TIME_RANGES = ['1h', '24h', '7d'] as const

/** Small preview swatches for each theme preset's chip (its land colour is enough to tell them
 * apart at a glance; "Store accent" shows the ring/pill instead, since its colour depends on
 * the merchant's own token). */
const THEME_SWATCH: Record<Exclude<GlobeThemePreset, 'accent'>, string> = {
  night: '#293548',
  ocean: '#3a6b66',
  mono: '#808080',
}

/**
 * The gear button next to the zoom controls: a popover with every Live view globe setting
 * (layers, motion, look, data), applied instantly (the caller passes each change straight to
 * the renderer as uniforms, never rebuilding the WebGL context) and saved to this browser only.
 */
export default function GlobeSettingsPanel({
  settings,
  dark,
  onChange,
  onReset,
}: GlobeSettingsPanelProps) {
  // Helpers
  const setLayer = (key: keyof GlobeLayerSettings, value: boolean) =>
    onChange({ layers: { ...settings.layers, [key]: value } })
  const setMotion = <K extends keyof GlobeMotionSettings>(key: K, value: GlobeMotionSettings[K]) =>
    onChange({ motion: { ...settings.motion, [key]: value } })
  const setLook = <K extends keyof GlobeLookSettings>(key: K, value: GlobeLookSettings[K]) =>
    onChange({ look: { ...settings.look, [key]: value } })
  const setData = (patch: Partial<GlobeSettings['data']>) =>
    onChange({ data: { ...settings.data, ...patch } })

  // Derived
  /* The theme's own colours, as drawn (custom picks left out), for the pickers to start from. */
  const themeSwatches = readPalette(
    dark,
    { theme: settings.look.theme, customLand: null, customOcean: null, customAccent: null },
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
            className="size-8"
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
        className="flex max-h-[min(48rem,calc(var(--available-height)-0.5rem))] w-80 flex-col gap-5 overflow-y-auto overscroll-contain bg-popover/95 p-4 backdrop-blur-md"
      >
        <div>
          <p className="text-body font-medium text-popover-foreground">{copy.title}</p>
          <p className="text-caption text-muted-foreground">{copy.subtitle}</p>
        </div>

        <Section heading={copy.layers.heading}>
          {LAYER_KEYS.map((key) => (
            <Row key={key} label={copy.layers[key]}>
              <Switch
                checked={settings.layers[key]}
                onCheckedChange={(v) => setLayer(key, v)}
                aria-label={copy.layers[key]}
              />
            </Row>
          ))}
        </Section>

        <Section heading={copy.motion.heading}>
          <Row label={copy.motion.autoRotate}>
            <Switch
              checked={settings.motion.autoRotate}
              onCheckedChange={(v) => setMotion('autoRotate', v)}
              aria-label={copy.motion.autoRotate}
            />
          </Row>
          <Row label={copy.motion.speed} stack>
            <PillTabs
              variant="segmented"
              tabs={MOTION_SPEEDS.map((s) => ({ value: s, label: copy.motion.speeds[s] }))}
              value={settings.motion.speed}
              onChange={(v) => v && setMotion('speed', v)}
            />
          </Row>
          <Row label={copy.motion.startView} stack>
            <PillTabs
              variant="segmented"
              tabs={START_VIEWS.map((s) => ({ value: s, label: copy.motion.startViews[s] }))}
              value={settings.motion.startView}
              onChange={(v) => v && setMotion('startView', v)}
            />
          </Row>
          <Row label={copy.motion.rememberZoom}>
            <Switch
              checked={settings.motion.rememberZoom}
              onCheckedChange={(v) => setMotion('rememberZoom', v)}
              aria-label={copy.motion.rememberZoom}
            />
          </Row>
        </Section>

        <Section heading={copy.look.heading}>
          <Row label={copy.look.style} stack>
            <PillTabs
              variant="segmented"
              tabs={STYLES.map((s) => ({ value: s, label: copy.look.styles[s] }))}
              value={settings.look.style}
              onChange={(v) => v && setLook('style', v)}
            />
          </Row>
          <Row
            label={copy.look.borderStyle}
            help={settings.layers.borders ? undefined : copy.look.borderStyleOff}
            stack
          >
            <PillTabs
              variant="segmented"
              tabs={STYLES.map((s) => ({ value: s, label: copy.look.borderStyles[s] }))}
              value={settings.look.borderStyle}
              onChange={(v) => v && setLook('borderStyle', v)}
            />
          </Row>
          <div className="flex flex-col gap-1.5">
            <Label className="text-caption text-muted-foreground">{copy.look.theme}</Label>
            <div className="flex flex-wrap gap-1.5">
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
          </div>
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
        </Section>

        <Section heading={copy.data.heading}>
          <Row label={copy.data.timeRange} stack>
            <PillTabs
              variant="segmented"
              tabs={TIME_RANGES.map((r) => ({ value: r, label: copy.data.timeRanges[r] }))}
              value={settings.data.timeRange}
              onChange={(v) => v && setData({ timeRange: v })}
            />
          </Row>
          <Row label={copy.data.highlightBigOrders} help={copy.data.highlightBigOrdersHelp}>
            <Switch
              checked={settings.data.highlightBigOrders}
              onCheckedChange={(v) => setData({ highlightBigOrders: v })}
              aria-label={copy.data.highlightBigOrders}
            />
          </Row>
          <Row label={copy.data.dayNightShadow} help={copy.data.dayNightShadowHelp}>
            <Switch
              checked={settings.data.dayNightShadow}
              onCheckedChange={(v) => setData({ dayNightShadow: v })}
              aria-label={copy.data.dayNightShadow}
            />
          </Row>
          <p className="text-caption text-muted-foreground">{copy.data.visitorsUnavailable}</p>
        </Section>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="self-center text-muted-foreground"
          onClick={onReset}
        >
          {copy.reset}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

type RowProps = { label: string; help?: string; stack?: boolean; children: ReactNode }

/** One settings row: a label (and optional help line, which wraps under it) with its control
 * on the right, at least 32px tall — or, when `stack` (a segmented control needs more width
 * than fits beside a label), the control on its own line below. */
function Row({ label, help, stack, children }: RowProps) {
  if (stack) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label className="text-caption text-muted-foreground">{label}</Label>
        {children}
        {help ? <span className="text-caption text-muted-foreground">{help}</span> : null}
      </div>
    )
  }
  return (
    <div className="flex min-h-8 items-center justify-between gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Label>{label}</Label>
        {help ? <span className="text-caption text-muted-foreground">{help}</span> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

type SectionProps = { heading: string; children: ReactNode }

/** A labelled group of rows, its heading the small muted eyebrow style also used on detail
 * pages' section labels. */
function Section({ heading, children }: SectionProps) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <p className="text-eyebrow">{heading}</p>
      <div className="flex flex-col gap-3">{children}</div>
    </div>
  )
}

type ThemeChipProps = {
  theme: GlobeThemePreset
  label: string
  active: boolean
  onClick: () => void
}

/** One theme preset as a small round swatch plus its name; "Store accent" shows the accent
 * token itself (via the ring utility class), the rest a fixed preview colour. */
function ThemeChip({ theme, label, active, onClick }: ThemeChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-caption transition-colors ${
        active
          ? 'border-ring bg-secondary text-ink-strong'
          : 'border-border text-muted-foreground hover:text-foreground'
      }`}
    >
      <span
        aria-hidden
        className={`size-3 rounded-full ${theme === 'accent' ? 'bg-primary' : ''}`}
        style={theme === 'accent' ? undefined : { backgroundColor: THEME_SWATCH[theme] }}
      />
      {label}
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
    <Row label={label}>
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
          className="size-6 cursor-pointer rounded-full border border-border bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch-wrapper]:rounded-full [&::-webkit-color-swatch-wrapper]:p-0"
        />
      </div>
    </Row>
  )
}
