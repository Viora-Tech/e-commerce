'use client'

import { REST_OF_WORLD } from '@commerce/core/shipping-rates'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { FieldError } from '@commerce/ui/shadcn/field'
import { Label } from '@commerce/ui/shadcn/label'
import DataCard from '@/components/layout/data-card'
import CountryPicker from '@/components/markets/country-picker'
import { shippingRatesContent } from '@/data/shipping-rates'
import { useCopy } from '@/hooks/use-copy'

type ZoneCountriesCardProps = {
  /** ISO codes, with `*` for Rest of world. */
  value: string[]
  onChange: (next: string[]) => void
  /** Shown after a save was tried with nothing picked. */
  invalid: boolean
  disabled?: boolean
}

const NONE_TAKEN: Record<string, string> = {}

/**
 * Where the zone ships (audit #160): India and any other countries, plus Rest of world. India
 * keeps the states and PIN code cards below; every other country is priced as a whole.
 */
export default function ZoneCountriesCard({
  value,
  onChange,
  invalid,
  disabled,
}: ZoneCountriesCardProps) {
  // Hooks
  const {
    zone: { countries: copy },
  } = useCopy(shippingRatesContent)

  // Event handlers
  const handleCountries = (next: string[]) => {
    onChange(value.includes(REST_OF_WORLD) ? [...next, REST_OF_WORLD] : next)
  }

  const handleRestOfWorld = (on: boolean) => {
    const countries = value.filter((c) => c !== REST_OF_WORLD)
    onChange(on ? [...countries, REST_OF_WORLD] : countries)
  }

  // Render logic
  const countries = value.filter((c) => c !== REST_OF_WORLD)
  const restOfWorld = value.includes(REST_OF_WORLD)
  const abroad = restOfWorld || countries.some((c) => c !== 'IN')

  return (
    <DataCard title={copy.heading} meta={copy.selected(countries.length + Number(restOfWorld))}>
      <div className="flex flex-col gap-3">
        <p className="text-body text-muted-foreground">{copy.meta}</p>
        <fieldset disabled={disabled} className="flex flex-col gap-3">
          <CountryPicker
            id="zone-countries"
            value={countries}
            taken={NONE_TAKEN}
            invalid={invalid}
            onChange={handleCountries}
          />
          <Label className="flex items-start gap-3 font-normal">
            <Checkbox
              checked={restOfWorld}
              onCheckedChange={(on) => handleRestOfWorld(on === true)}
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-body text-ink-strong">{copy.restOfWorld}</span>
              <span className="text-caption text-muted-foreground">{copy.restOfWorldHelp}</span>
            </span>
          </Label>
        </fieldset>
        {invalid ? <FieldError>{copy.none}</FieldError> : null}
        {abroad ? <p className="text-caption text-muted-foreground">{copy.abroadNote}</p> : null}
      </div>
    </DataCard>
  )
}
