'use client'

import { isPincodePattern, type PincodeRule } from '@commerce/core/shipping-rates'
import { Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy } from '@/hooks/use-copy'

type ZonePincodesCardProps = {
  value: PincodeRule[]
  onChange: (next: PincodeRule[]) => void
  disabled?: boolean
}

/** Why the typed rule was not added; the message is looked up at render. */
type PincodeError = 'invalid' | 'duplicate'

/** Include or exclude PIN codes (`560001`) and prefixes (`560*`). */
export default function ZonePincodesCard({ value, onChange, disabled }: ZonePincodesCardProps) {
  // Hooks
  const {
    zone: { pincodes: copy },
  } = useCopy(shippingRatesContent)
  const [pattern, setPattern] = useState('')
  const [mode, setMode] = useState<PincodeRule['mode']>('include')
  const [error, setError] = useState<PincodeError | null>(null)

  // Event handlers
  const handleAdd = () => {
    const p = pattern.trim()
    if (!isPincodePattern(p)) {
      setError('invalid')
      return
    }
    if (value.some((r) => r.pattern === p && r.mode === mode)) {
      setError('duplicate')
      return
    }
    onChange([...value, { pattern: p, mode }])
    setPattern('')
    setError(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    handleAdd()
  }

  const handleRemove = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  // Render logic
  const modes = [
    { value: 'include', label: copy.include },
    { value: 'exclude', label: copy.exclude },
  ]

  return (
    <DataCard title={copy.heading} meta={copy.meta}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field data-invalid={error ? true : undefined} className="w-full max-w-60">
            <FieldLabel htmlFor="zone-pincode">{copy.pattern}</FieldLabel>
            <Input
              id="zone-pincode"
              size="lg"
              inputMode="numeric"
              value={pattern}
              placeholder={copy.patternPlaceholder}
              onChange={(e) => setPattern(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={disabled}
            />
          </Field>
          <div className="w-40">
            <ChoiceField
              id="zone-pincode-mode"
              label={copy.mode}
              value={mode}
              options={modes}
              onChange={(v) => setMode(v as PincodeRule['mode'])}
            />
          </div>
          <Button variant="outline" size="lg" onClick={handleAdd} disabled={disabled}>
            {copy.add}
          </Button>
        </div>
        {error ? <FieldError>{copy[error]}</FieldError> : null}
        {value.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.none}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {value.map((r, i) => (
              <li
                key={`${r.mode}-${r.pattern}`}
                className="flex items-center gap-2 rounded-md border border-border py-1 pr-1 pl-3"
              >
                <span className="font-mono text-body">{r.pattern}</span>
                <StatusChip tone={r.mode === 'exclude' ? 'danger' : 'neutral'}>
                  {r.mode === 'exclude' ? copy.exclude : copy.include}
                </StatusChip>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={copy.remove(r.pattern)}
                  onClick={() => handleRemove(i)}
                  disabled={disabled}
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DataCard>
  )
}
