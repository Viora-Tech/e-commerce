'use client'

import { Settings as GearIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Label } from '@commerce/ui/shadcn/label'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { Switch } from '@commerce/ui/shadcn/switch'
import type { ReactNode } from 'react'
import { globeSettingsContent as copy } from '@/data/live-globe'
import type {
  GlobeLayerSettings,
  GlobeLookSettings,
  GlobeMotionSettings,
  GlobeSettings,
} from './globe-settings'

type GlobeSettingsPanelProps = {
  settings: GlobeSettings
  onChange: (patch: Partial<GlobeSettings>) => void
  onReset: () => void
}

const LAYER_KEYS = ['borders', 'coastlines', 'grid', 'arcs', 'glow'] as const
const MOTION_SPEEDS = ['slow', 'normal', 'fast'] as const
const START_VIEWS = ['india', 'mine', 'world'] as const
const STYLES = ['solid', 'dotted'] as const
const THEMES = ['accent', 'night', 'ocean', 'mono'] as const
const TIME_RANGES = ['1h', '24h', '7d'] as const

/** A `Select`'s `items` map is only used for its labels; the value/label pairs below already
 * carry those, so this just satisfies the prop without repeating them. */
function asItems<T extends string>(labels: Record<T, string>): Record<T, string> {
  return labels
}

/**
 * The gear button next to the zoom controls: a popover with every Live view globe setting
 * (layers, motion, look, data), applied instantly (the caller passes each change straight to
 * the renderer as uniforms, never rebuilding the WebGL context) and saved to this browser only.
 */
export default function GlobeSettingsPanel({
  settings,
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
      <PopoverContent
        align="end"
        className="max-h-[min(32rem,80svh)] w-[19rem] space-y-4 overflow-y-auto"
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
          <Row label={copy.motion.speed}>
            <Select
              items={asItems(copy.motion.speeds)}
              value={settings.motion.speed}
              onValueChange={(v) => v && setMotion('speed', v as (typeof MOTION_SPEEDS)[number])}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOTION_SPEEDS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {copy.motion.speeds[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label={copy.motion.startView}>
            <Select
              items={asItems(copy.motion.startViews)}
              value={settings.motion.startView}
              onValueChange={(v) => v && setMotion('startView', v as (typeof START_VIEWS)[number])}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {START_VIEWS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {copy.motion.startViews[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
          <Row label={copy.look.style}>
            <Select
              items={asItems(copy.look.styles)}
              value={settings.look.style}
              onValueChange={(v) => v && setLook('style', v as (typeof STYLES)[number])}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {copy.look.styles[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label={copy.look.theme}>
            <Select
              items={asItems(copy.look.themes)}
              value={settings.look.theme}
              onValueChange={(v) => v && setLook('theme', v as (typeof THEMES)[number])}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THEMES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {copy.look.themes[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <Row label={copy.look.borderStyle}>
            <Select
              items={asItems(copy.look.borderStyles)}
              value={settings.look.borderStyle}
              onValueChange={(v) => v && setLook('borderStyle', v as (typeof STYLES)[number])}
            >
              <SelectTrigger size="sm" className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {copy.look.borderStyles[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          <ColorRow
            label={copy.look.customLand}
            value={settings.look.customLand}
            fallback="#8a8a8a"
            onChange={(v) => setLook('customLand', v)}
          />
          <ColorRow
            label={copy.look.customOcean}
            value={settings.look.customOcean}
            fallback="#141b26"
            onChange={(v) => setLook('customOcean', v)}
          />
          <ColorRow
            label={copy.look.customAccent}
            value={settings.look.customAccent}
            fallback="#4fb37e"
            onChange={(v) => setLook('customAccent', v)}
          />
        </Section>

        <Section heading={copy.data.heading}>
          <Row label={copy.data.timeRange}>
            <Select
              items={asItems(copy.data.timeRanges)}
              value={settings.data.timeRange}
              onValueChange={(v) => v && setData({ timeRange: v as (typeof TIME_RANGES)[number] })}
            >
              <SelectTrigger size="sm" className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_RANGES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {copy.data.timeRanges[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        <Button type="button" variant="outline" className="w-full" onClick={onReset}>
          {copy.reset}
        </Button>
      </PopoverContent>
    </Popover>
  )
}

type RowProps = { label: string; help?: string; children: ReactNode }

/** One settings row: a label (and optional help line) with its control on the right. */
function Row({ label, help, children }: RowProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex flex-col">
        <Label>{label}</Label>
        {help ? <span className="text-caption text-muted-foreground">{help}</span> : null}
      </div>
      {children}
    </div>
  )
}

type SectionProps = { heading: string; children: ReactNode }

/** A labelled group of rows. */
function Section({ heading, children }: SectionProps) {
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-caption font-medium text-muted-foreground uppercase tracking-wide">
        {heading}
      </p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  )
}

type ColorRowProps = {
  label: string
  value: string | null
  fallback: string
  onChange: (hex: string | null) => void
}

/** A colour picker row that also offers "use theme colour" (clears the override) once one is
 * picked. */
function ColorRow({ label, value, fallback, onChange }: ColorRowProps) {
  return (
    <Row label={label}>
      <div className="flex items-center gap-2">
        {value ? (
          <button
            type="button"
            className="text-caption text-muted-foreground underline underline-offset-2"
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
          className="size-7 cursor-pointer rounded-md border border-border bg-transparent p-0.5"
        />
      </div>
    </Row>
  )
}
