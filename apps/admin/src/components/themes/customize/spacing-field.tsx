'use client'

import { Minus, Monitor, Plus, Smartphone, Tablet } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import SettingsSegmented from './settings-segmented'

type Device = 'mobile' | 'tablet' | 'desktop'
type Padding = Partial<Record<Device, number>>
type Side = 'paddingTop' | 'paddingBottom'

type SpacingFieldProps = {
  value: { paddingTop?: Padding; paddingBottom?: Padding }
  max: number
  /** Both sides at once, so a quick size changes top and bottom in one edit. */
  onChange: (patch: Partial<Record<Side, Padding>>) => void
}

const copy = customizeContent.settingsControls
const devices = customizeContent.fields.breakpoints

const DEVICES = [
  { value: 'desktop' as const, label: devices.desktop, icon: Monitor },
  { value: 'tablet' as const, label: devices.tablet, icon: Tablet },
  { value: 'mobile' as const, label: devices.mobile, icon: Smartphone },
]

/** One press of a stepper; Shift steps ten times as far, as number fields do. */
const STEP = 4

const STEPPER =
  'flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:pointer-events-none disabled:opacity-35 motion-reduce:transition-none'

/**
 * Section padding per screen size, as the Figma inspector draws spacing (369:129702): an
 * "Editing" device switch, then a spacing box with the top and bottom padding around the
 * section, each a number with − / + steppers, and quick sizes (None, S, M, L, XL) that set both.
 */
export default function SpacingField({ value, max, onChange }: SpacingFieldProps) {
  // Hooks
  const [device, setDevice] = useState<Device>('desktop')

  // Helpers
  const current = (side: Side): number => {
    const v = value[side]?.[device]
    return typeof v === 'number' ? v : 0
  }
  const clamp = (next: number) => Math.min(max, Math.max(0, Math.round(next)))
  const set = (side: Side, next: number) => {
    onChange({ [side]: { ...value[side], [device]: clamp(next) } })
  }

  /** One side's value box: − / number / +. */
  const side = (key: Side) => (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-card p-0.5">
      <button
        type="button"
        onClick={(e) => set(key, current(key) - (e.shiftKey ? STEP * 10 : STEP))}
        disabled={current(key) <= 0}
        aria-label={copy.decrease(copy[key])}
        title={copy.decrease(copy[key])}
        className={STEPPER}
      >
        <Minus aria-hidden weight="regular" className="size-3" />
      </button>
      <label className="flex h-6 items-center gap-0.5 text-xs leading-[1.0625rem]">
        <span className="sr-only">{`${copy[key]}, ${devices[device]}`}</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          step={STEP}
          value={current(key)}
          onChange={(e) => handleType(key, e.target.value)}
          className="w-8 [appearance:textfield] bg-transparent text-right font-medium text-foreground tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <span aria-hidden className="text-muted-foreground">
          {copy.unit}
        </span>
      </label>
      <button
        type="button"
        onClick={(e) => set(key, current(key) + (e.shiftKey ? STEP * 10 : STEP))}
        disabled={current(key) >= max}
        aria-label={copy.increase(copy[key])}
        title={copy.increase(copy[key])}
        className={STEPPER}
      >
        <Plus aria-hidden weight="regular" className="size-3" />
      </button>
    </div>
  )

  // Event handlers
  const handleType = (side: Side, raw: string) => {
    const next = Number(raw)
    if (raw !== '' && !Number.isNaN(next)) set(side, next)
  }
  const handlePreset = (size: number) => {
    onChange({
      paddingTop: { ...value.paddingTop, [device]: clamp(size) },
      paddingBottom: { ...value.paddingBottom, [device]: clamp(size) },
    })
  }

  // Render logic
  const top = current('paddingTop')
  const bottom = current('paddingBottom')
  const preset = top === bottom ? top : null
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{copy.editing}</span>
        <SettingsSegmented
          label={copy.device}
          options={DEVICES}
          value={device}
          onChange={setDevice}
          hideLabel
          fill={false}
        />
      </div>
      <div className="flex flex-col items-center gap-1.5 rounded-xl border border-primary bg-muted p-2.5">
        <span className="text-[0.625rem] leading-[1.0625rem] font-medium tracking-[0.05em] text-muted-foreground uppercase">
          {copy.padding}
        </span>
        {side('paddingTop')}
        <span className="flex h-9 w-full items-center justify-center rounded-md bg-primary-soft text-xs leading-[1.0625rem] font-medium text-foreground">
          {copy.section}
        </span>
        {side('paddingBottom')}
      </div>
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">{copy.presetsLabel}</legend>
        {copy.presets.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={preset === p.value}
            onClick={() => handlePreset(p.value)}
            className={cn(
              'rounded-lg border px-3 py-[0.3125rem] text-xs leading-[1.0625rem] font-medium text-foreground transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none',
              preset === p.value
                ? 'border-primary bg-primary-soft'
                : 'border-border bg-card hover:bg-muted/60',
            )}
          >
            {p.label}
          </button>
        ))}
      </fieldset>
    </div>
  )
}
