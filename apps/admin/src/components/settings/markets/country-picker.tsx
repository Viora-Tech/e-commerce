'use client'

import { COUNTRY_CODES } from '@commerce/core/markets'
import { Plus, Search, XIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@commerce/ui/shadcn/input-group'
import { Label } from '@commerce/ui/shadcn/label'
import { useState } from 'react'
import { marketsContent } from '@/data/markets'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { INTL_LOCALE, type Locale } from '@/lib/i18n'

type CountryPickerProps = {
  id: string
  /** The market's countries, in the order they were picked. */
  value: string[]
  /** Countries another market already holds, with that market's name. */
  taken: Record<string, string>
  invalid: boolean
  onChange: (next: string[]) => void
}

/** Countries a merchant usually sells to together, one click each (audit #115). */
const REGIONS = {
  eu: [
    'AT',
    'BE',
    'BG',
    'HR',
    'CY',
    'CZ',
    'DK',
    'EE',
    'FI',
    'FR',
    'DE',
    'GR',
    'HU',
    'IE',
    'IT',
    'LV',
    'LT',
    'LU',
    'MT',
    'NL',
    'PL',
    'PT',
    'RO',
    'SK',
    'SI',
    'ES',
    'SE',
  ],
  gulf: ['AE', 'SA', 'QA', 'KW', 'BH', 'OM'],
  northAmerica: ['US', 'CA'],
  oceania: ['AU', 'NZ'],
} as const

/** A country's flag from its code (regional indicator letters); no images to ship. */
const flagOf = (code: string) =>
  String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))

/** One `Intl.DisplayNames` per language tag, made on first use. */
const regionNames = new Map<string, Intl.DisplayNames>()

function regionName(code: string, tag: string): string {
  let names = regionNames.get(tag)
  if (!names) {
    names = new Intl.DisplayNames([tag], { type: 'region' })
    regionNames.set(tag, names)
  }
  return names.of(code) ?? code
}

/** A country's name in the admin's language, and in English so either finds it. */
function namesOf(code: string, locale: Locale): { shown: string; english: string } {
  return { shown: regionName(code, INTL_LOCALE[locale]), english: regionName(code, 'en') }
}

/**
 * Every country as a searchable checklist, with the picked ones as chips above it. A country
 * another market holds stays visible but cannot be ticked, and says which market has it.
 */
export default function CountryPicker({ id, value, taken, invalid, onChange }: CountryPickerProps) {
  // Hooks
  const copy = useCopy(marketsContent)
  const locale = useLocale()
  const [query, setQuery] = useState('')

  // Event handlers
  const handleToggle = (code: string, on: boolean) => {
    onChange(on ? [...value, code] : value.filter((c) => c !== code))
  }

  /** Every country of a region not already here or held by another market. */
  const handleRegion = (codes: readonly string[]) => {
    const add = codes.filter((c) => !value.includes(c) && !taken[c])
    if (add.length > 0) onChange([...value, ...add])
  }

  // Render logic
  const text = copy.dialog.countries
  const q = query.trim().toLowerCase()
  const rows = COUNTRY_CODES.map((code) => ({ code, ...namesOf(code, locale) }))
    .filter(
      (r) =>
        !q ||
        r.code.toLowerCase() === q ||
        r.shown.toLowerCase().includes(q) ||
        r.english.toLowerCase().includes(q),
    )
    .sort((a, b) => a.shown.localeCompare(b.shown, INTL_LOCALE[locale]))

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {value.map((code) => {
            const name = namesOf(code, locale).shown
            return (
              <li
                key={code}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-line bg-muted pr-0.5 pl-2 text-caption text-ink-strong"
              >
                <span aria-hidden="true">{flagOf(code)}</span>
                {name}
                <button
                  type="button"
                  aria-label={text.remove(name)}
                  onClick={() => handleToggle(code, false)}
                  className="flex size-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <XIcon className="size-3" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(REGIONS) as (keyof typeof REGIONS)[]).map((key) => (
          <Button
            key={key}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleRegion(REGIONS[key])}
            aria-label={text.addRegion(text.regions[key])}
          >
            <Plus aria-hidden="true" />
            {text.regions[key]}
          </Button>
        ))}
      </div>
      <InputGroup>
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          value={query}
          placeholder={text.search}
          autoComplete="off"
          aria-invalid={invalid ? true : undefined}
          onChange={(e) => setQuery(e.target.value)}
        />
      </InputGroup>
      <div className="max-h-56 overflow-y-auto overscroll-contain rounded-lg border border-line p-1">
        {rows.length === 0 ? (
          <p className="px-2 py-3 text-center text-body text-muted-foreground">{text.none}</p>
        ) : (
          rows.map((r) => {
            const owner = taken[r.code]
            return (
              <Label
                key={r.code}
                className={cn(
                  'flex h-8 items-center gap-3 rounded-md px-2 font-normal text-body leading-normal',
                  owner ? 'text-muted-foreground' : 'cursor-pointer hover:bg-muted',
                )}
              >
                <Checkbox
                  checked={value.includes(r.code)}
                  disabled={Boolean(owner)}
                  onCheckedChange={(on) => handleToggle(r.code, on === true)}
                />
                <span aria-hidden="true">{flagOf(r.code)}</span>
                <span className="min-w-0 flex-1 truncate">{r.shown}</span>
                <span className="shrink-0 text-caption text-muted-foreground">
                  {owner ? text.inMarket(owner) : r.code}
                </span>
              </Label>
            )
          })
        )}
      </div>
    </div>
  )
}
