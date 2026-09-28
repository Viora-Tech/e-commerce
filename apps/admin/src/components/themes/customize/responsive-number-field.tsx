'use client'

import { type IconComponent, Monitor, Smartphone, Tablet } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { customizeContent } from '@/data/customize'
import type { FieldLike } from '@/lib/customize-field-shape'
import { FIELD_CONTROL } from '@/lib/customize-field-styles'
import FieldFrame from './field-frame'

type Breakpoint = 'mobile' | 'tablet' | 'desktop'

type ResponsiveNumberFieldProps = {
  label: string
  field: FieldLike
  value: Record<string, unknown>
  onChange: (key: Breakpoint, value: number) => void
}

const BREAKPOINTS: { key: Breakpoint; icon: IconComponent }[] = [
  { key: 'mobile', icon: Smartphone },
  { key: 'tablet', icon: Tablet },
  { key: 'desktop', icon: Monitor },
]

const copy = customizeContent.fields

/**
 * One number per screen size (section padding), side by side with a device
 * glyph each — three short inputs on one row instead of three full-width
 * sliders stacked, which was the longest stretch of the settings panel.
 */
export default function ResponsiveNumberField({
  label,
  field,
  value,
  onChange,
}: ResponsiveNumberFieldProps) {
  // Event handlers
  const handleChange = (key: Breakpoint, raw: string) => {
    const next = Number(raw)
    if (raw !== '' && !Number.isNaN(next)) onChange(key, next)
  }

  // Render logic
  const sub = (field.objectFields ?? {}) as Record<string, { min?: number; max?: number }>

  return (
    <FieldFrame label={label}>
      <div className="grid grid-cols-3 gap-1.5">
        {BREAKPOINTS.map(({ key, icon: Icon }) => (
          <span key={key} className="relative flex items-center" title={copy.breakpoints[key]}>
            <Icon
              aria-hidden
              weight="regular"
              className="pointer-events-none absolute left-2 size-3.5 text-muted-foreground"
            />
            <Input
              type="number"
              value={typeof value[key] === 'number' ? (value[key] as number) : ''}
              min={sub[key]?.min}
              max={sub[key]?.max}
              aria-label={`${label}, ${copy.breakpoints[key]}`}
              onChange={(e) => handleChange(key, e.target.value)}
              size="lg"
              className={cn(FIELD_CONTROL, 'pr-1.5 pl-7 tabular-nums')}
            />
          </span>
        ))}
      </div>
    </FieldFrame>
  )
}
