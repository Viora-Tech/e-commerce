'use client'

import { Monitor, Smartphone, Tablet } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import { customizeContent } from '@/data/customize'
import { FIELD_CONTROL } from '@/lib/customize-field-styles'
import SettingsSegmented from './settings-segmented'

type Device = 'mobile' | 'tablet' | 'desktop'
type Padding = Partial<Record<Device, number>>

type SpacingFieldProps = {
  value: { paddingTop?: Padding; paddingBottom?: Padding }
  max: number
  onChange: (key: 'paddingTop' | 'paddingBottom', value: Padding) => void
}

const copy = customizeContent.settingsControls
const devices = customizeContent.fields.breakpoints

const DEVICES = [
  { value: 'desktop' as const, label: devices.desktop, icon: Monitor },
  { value: 'tablet' as const, label: devices.tablet, icon: Tablet },
  { value: 'mobile' as const, label: devices.mobile, icon: Smartphone },
]

/**
 * Section padding per screen size: one device switch, then the top and bottom space for that
 * screen. Six numbers become two at a time, and the switch says which screen they are for.
 */
export default function SpacingField({ value, max, onChange }: SpacingFieldProps) {
  // Hooks
  const [device, setDevice] = useState<Device>('desktop')

  // Event handlers
  const handleChange = (key: 'paddingTop' | 'paddingBottom', raw: string) => {
    const next = Number(raw)
    if (raw === '' || Number.isNaN(next)) return
    onChange(key, { ...value[key], [device]: Math.min(max, Math.max(0, next)) })
  }

  // Render logic
  const deviceLabel = devices[device].toLowerCase()

  return (
    <div className="flex flex-col gap-2">
      <SettingsSegmented
        label={copy.device}
        options={DEVICES}
        value={device}
        onChange={setDevice}
        hideLabel
      />
      <p className="text-xs text-muted-foreground">{copy.spacingHint(deviceLabel)}</p>
      <div className="grid grid-cols-2 gap-2">
        {(['paddingTop', 'paddingBottom'] as const).map((key) => (
          <div key={key} className="flex flex-col gap-1">
            <span className="text-xs font-medium text-foreground">{copy[key]}</span>
            <span className="relative flex items-center">
              <Input
                type="number"
                min={0}
                max={max}
                value={
                  typeof value[key]?.[device] === 'number' ? (value[key]?.[device] as number) : ''
                }
                onChange={(e) => handleChange(key, e.target.value)}
                aria-label={`${copy[key]}, ${devices[device]}`}
                size="lg"
                className={cn(FIELD_CONTROL, 'pr-8 tabular-nums')}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute right-2.5 text-xs text-muted-foreground"
              >
                {copy.unit}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
