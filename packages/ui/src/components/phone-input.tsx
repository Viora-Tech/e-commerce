'use client'

import { phoneInputMetadata } from '@commerce/phone'
import * as React from 'react'
import PhoneNumberInput, {
  type Country,
  type FlagProps,
  getCountryCallingCode,
} from 'react-phone-number-input'
import flags from 'react-phone-number-input/flags'
import labels from 'react-phone-number-input/locale/en'
import { CheckIcon, ChevronsUpDown } from '../icons'
import { cn } from '../lib/utils'
import { Button } from './shadcn/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './shadcn/command'
import { Input } from './shadcn/input'
import { Popover, PopoverContent, PopoverTrigger } from './shadcn/popover'

export type PhoneInputProps = Omit<
  React.ComponentProps<'input'>,
  'onChange' | 'value' | 'defaultValue' | 'ref' | 'size'
> & {
  /** E.164 ("+919876543210"). Older stored values ("98765 43210", "919876543210") are read in `defaultCountry`. */
  value?: string | null | undefined
  /** Called with E.164 while the number is valid or still being typed, and '' when cleared. */
  onChange: (value: string) => void
  /** Country a number without a "+" belongs to. */
  defaultCountry?: Country
  /** Limit the picker to these countries; one country locks the selector. */
  countries?: Country[]
  searchPlaceholder?: string
  emptyText?: string
}

/** Stored text -> the E.164 the input needs; keeps a half typed "+91 98" so typing is not undone. */
function toInputValue(
  value: string | null | undefined,
  defaultCountry: Country,
): string | undefined {
  const text = value?.trim()
  if (!text) return undefined
  if (text.startsWith('+')) return `+${text.replace(/\D/g, '')}`
  const digits = text.replace(/\D/g, '')
  if (!digits) return undefined
  const code = getCountryCallingCode(defaultCountry)
  const national = digits.startsWith('0') ? digits.slice(1) : digits
  // "919876543210" is written with its calling code but no "+".
  if (national.startsWith(code) && national.length > code.length + 6) return `+${national}`
  return `+${code}${national}`
}

function Flag({ country, countryName }: FlagProps) {
  const Svg = flags[country]
  return (
    <span className="flex h-4 w-6 shrink-0 overflow-hidden rounded-xs bg-muted [&_svg:not([class*='size-'])]:size-full">
      {Svg ? <Svg title={countryName} /> : null}
    </span>
  )
}

function NumberField({ className, size: _size, ...props }: React.ComponentProps<'input'>) {
  return (
    <Input
      size="lg"
      type="tel"
      className={cn('rounded-s-none focus-visible:z-10', className)}
      {...props}
    />
  )
}

type CountryEntry = { label: string; value?: Country | undefined }

type CountrySelectProps = {
  disabled?: boolean | undefined
  onChange: (country?: Country | undefined) => void
  options: CountryEntry[]
  value?: Country | undefined
  searchPlaceholder: string
  emptyText: string
}

function CountrySelect({
  disabled,
  onChange,
  options,
  value: selected,
  searchPlaceholder,
  emptyText,
}: CountrySelectProps) {
  // Hooks
  const [open, setOpen] = React.useState(false)

  // Event handlers
  const handleSelect = (country: Country) => {
    onChange(country)
    setOpen(false)
  }

  // Render logic
  const locked = options.filter((o) => o.value).length < 2
  const code = selected ? `+${getCountryCallingCode(selected)}` : ''

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled || locked}
        render={
          <Button
            type="button"
            variant="outline"
            className="h-9 shrink-0 gap-1.5 rounded-e-none border-input bg-input-surface px-2.5 text-foreground hover:border-border-strong focus-visible:z-10"
            aria-label={selected ? `Country: ${labels[selected]} ${code}` : 'Choose a country'}
          />
        }
      >
        {selected ? <Flag country={selected} countryName={labels[selected]} /> : null}
        <span className="text-body tabular-nums">{code}</span>
        {locked ? null : <ChevronsUpDown className="size-3.5 text-muted-foreground" />}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] gap-0 p-0">
        <Command>
          <CommandInput placeholder={searchPlaceholder} autoFocus />
          <CommandList className="max-h-72">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const country = option.value
                if (!country) return null
                const callingCode = getCountryCallingCode(country)
                return (
                  <CommandItem
                    key={country}
                    value={`${option.label} +${callingCode} ${country}`}
                    onSelect={() => handleSelect(country)}
                    className="gap-2"
                  >
                    <Flag country={country} countryName={option.label} />
                    <span className="flex-1 truncate">{option.label}</span>
                    <span className="text-muted-foreground tabular-nums">+{callingCode}</span>
                    <CheckIcon
                      className={cn(
                        'size-4 text-primary',
                        country === selected ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export default function PhoneInput({
  value,
  onChange,
  defaultCountry = 'IN',
  countries,
  searchPlaceholder = 'Search country or code',
  emptyText = 'No country found.',
  className,
  disabled,
  ...props
}: PhoneInputProps) {
  // Event handlers
  const handleChange = (next?: string) => onChange(next ?? '')

  // Render logic
  const initial = countries?.includes(defaultCountry)
    ? defaultCountry
    : (countries?.[0] ?? defaultCountry)

  return (
    <PhoneNumberInput
      className={cn('flex w-full', className)}
      value={toInputValue(value, initial)}
      onChange={handleChange}
      defaultCountry={initial}
      countries={countries}
      metadata={phoneInputMetadata}
      labels={labels}
      disabled={disabled}
      smartCaret={false}
      limitMaxLength
      international={false}
      flagComponent={Flag}
      inputComponent={NumberField}
      countrySelectComponent={(
        selectProps: Omit<CountrySelectProps, 'searchPlaceholder' | 'emptyText'>,
      ) => (
        <CountrySelect
          {...selectProps}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
        />
      )}
      {...props}
    />
  )
}
