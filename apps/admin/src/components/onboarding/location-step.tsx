'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { COUNTRIES } from '@/data/countries'
import { INDIAN_STATES } from '@/data/india'
import { onboardingContent as copy } from '@/data/onboarding'

export type LocationValue = { country: string; state: string }

type LocationStepProps = {
  value: LocationValue
  onChange: (value: LocationValue) => void
  onNext: () => void
}

const countryItems = COUNTRIES.map((c) => ({ value: c.code, label: c.name }))
/** Stored by name, the same free text Settings › General shows; GST reads either form. */
const stateItems = INDIAN_STATES.map((s) => ({ value: s.name, label: s.name }))

/** Screen 3: country (India by default) and, in India, the state that decides GST. */
export default function LocationStep({ value, onChange, onNext }: LocationStepProps) {
  // Event handlers
  const handleCountry = (country: string) => {
    onChange({ country, state: country === 'IN' ? value.state : '' })
  }

  // Render logic
  const inIndia = value.country === 'IN'
  const canContinue = !inIndia || value.state.length > 0

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-page-title text-ink-strong">{copy.location.heading}</h1>
        <p className="text-body text-muted-foreground">{copy.location.body}</p>
      </div>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="onboarding-country">{copy.location.country}</FieldLabel>
          <Select
            items={countryItems}
            value={value.country}
            onValueChange={(code) => code && handleCountry(String(code))}
          >
            <SelectTrigger id="onboarding-country" size="lg" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {countryItems.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {inIndia ? null : <FieldDescription>{copy.location.outsideIndia}</FieldDescription>}
        </Field>
        {inIndia ? (
          <Field>
            <FieldLabel htmlFor="onboarding-state">{copy.location.state}</FieldLabel>
            <Select
              items={stateItems}
              value={value.state || null}
              onValueChange={(state) => state && onChange({ ...value, state: String(state) })}
            >
              <SelectTrigger id="onboarding-state" size="lg" className="w-full">
                <SelectValue placeholder={copy.location.statePlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {stateItems.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        ) : null}
      </FieldGroup>
      <Button type="button" size="lg" className="w-full" disabled={!canContinue} onClick={onNext}>
        {copy.next}
      </Button>
    </div>
  )
}
