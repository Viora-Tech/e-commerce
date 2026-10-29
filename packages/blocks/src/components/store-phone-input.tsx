'use client'

import type { MetadataJson } from 'libphonenumber-js/core'
import metadata from 'libphonenumber-js/min/metadata'
import { useEffect, useId, useRef, useState } from 'react'
import PhoneNumberInput, {
  type Country,
  type FlagProps,
  getCountryCallingCode,
} from 'react-phone-number-input'
import flags from 'react-phone-number-input/flags'
import labels from 'react-phone-number-input/locale/en'

export type StorePhoneInputProps = {
  id?: string
  name?: string
  /** E.164 ("+919876543210"). Older stored values ("98765 43210", "919876543210") are read in `defaultCountry`. */
  value?: string | null | undefined
  /** Called with E.164 while the number is valid or still being typed, and '' when cleared. */
  onChange: (value: string) => void
  onBlur?: () => void
  defaultCountry?: Country
  /** Limit the picker to these countries; one country locks the selector. */
  countries?: Country[]
  placeholder?: string
  required?: boolean
  autoComplete?: string
  disabled?: boolean
  'aria-invalid'?: boolean | undefined
  'aria-describedby'?: string | undefined
  searchPlaceholder?: string
  emptyText?: string
  /** Wrapper, number box and country button classes. A box or button class replaces the default look (theme tokens); the checkout passes its own. */
  className?: string
  inputClassName?: string
  triggerClassName?: string
}

const DEFAULT_LOOK =
  'border border-line bg-surface text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-invalid:border-danger disabled:opacity-60'
const DEFAULT_INPUT = `${DEFAULT_LOOK} px-3 py-3`
const DEFAULT_TRIGGER = `${DEFAULT_LOOK} border-e-0 px-3`

/**
 * The numbering metadata without the trunk prefix where a country's national format only
 * optionally writes it. The picker fills the number box from `formatNational()`, which writes an
 * Indian mobile as "098765 43210", so a restored or prefilled "+919876543210" showed a 0 the
 * shopper never typed (#926). Countries whose national format needs the 0 (UK "07911 123456")
 * keep it, and a 0 the shopper types is still read as the trunk prefix.
 */
function withoutOptionalTrunkPrefix(meta: MetadataJson): MetadataJson {
  const countries = Object.fromEntries(
    Object.entries(meta.countries).map(([code, plan]) => {
      // Format rows: [pattern, format, leading digits, prefix formatting rule, prefix optional, ...].
      const formats = (plan as unknown[])[4]
      if (!Array.isArray(formats)) return [code, plan]
      const next = [...(plan as unknown[])]
      next[4] = formats.map((f: unknown[]) =>
        f[4] && typeof f[3] === 'string' ? [f[0], f[1], f[2], '$1', ...f.slice(4)] : f,
      )
      return [code, next]
    }),
  )
  return { ...meta, countries } as MetadataJson
}

const METADATA = withoutOptionalTrunkPrefix(metadata)

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
    <span className="flex h-4 w-6 shrink-0 overflow-hidden rounded-xs bg-line [&_svg]:size-full">
      {Svg ? <Svg title={countryName} /> : null}
    </span>
  )
}

function NumberBox({ className = '', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type="tel"
      className={`min-w-0 flex-1 rounded-e-[inherit] outline-none focus-visible:z-10 ${className || DEFAULT_INPUT}`}
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
  triggerClassName: string
}

function CountrySelect({
  disabled,
  onChange,
  options,
  value: selected,
  searchPlaceholder,
  emptyText,
  triggerClassName,
}: CountrySelectProps) {
  // Hooks
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Event handlers
  const handlePick = (country: Country) => {
    onChange(country)
    setOpen(false)
    triggerRef.current?.focus()
  }

  const handleToggle = () => {
    setQuery('')
    setActive(Math.max(0, matchesIndex(real, selected)))
    setOpen((v) => !v)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, matchCountries(real, query).length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = matchCountries(real, query)[active]
      if (hit) handlePick(hit.value)
    }
  }

  // Render logic
  const real = options.filter((o): o is { label: string; value: Country } => Boolean(o.value))
  const matches = matchCountries(real, query)
  const locked = real.length < 2
  const code = selected ? `+${getCountryCallingCode(selected)}` : ''

  return (
    <div ref={rootRef} className="relative flex rounded-[inherit]">
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || locked}
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={selected ? `Country: ${labels[selected]} ${code}` : 'Choose a country'}
        className={`flex shrink-0 items-center gap-1.5 rounded-s-[inherit] outline-none focus-visible:z-10 ${triggerClassName || DEFAULT_TRIGGER}`}
      >
        {selected ? <Flag country={selected} countryName={labels[selected]} /> : null}
        <span className="tabular-nums">{code}</span>
        {locked ? null : (
          <svg aria-hidden="true" viewBox="0 0 12 12" className="size-3 text-muted" fill="none">
            <path
              d="m3 4.5 3 3 3-3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
      {open ? (
        <div className="absolute start-0 top-full z-50 mt-1 flex w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-line bg-surface text-ink shadow-lg">
          <input
            // biome-ignore lint/a11y/noAutofocus: the search box is the only thing in the opened list.
            autoFocus
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={
              matches[active] ? `${listId}-${matches[active].value}` : undefined
            }
            aria-label={searchPlaceholder}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            onKeyDown={handleKeyDown}
            className="w-full border-0 border-b border-line bg-transparent px-3 py-2.5 text-[1rem] text-ink outline-none placeholder:text-muted"
          />
          <div
            id={listId}
            role="listbox"
            className="max-h-64 overflow-y-auto overscroll-contain p-1"
          >
            {matches.length === 0 ? <div className="px-3 py-2 text-muted">{emptyText}</div> : null}
            {matches.map((o, i) => (
              <div
                key={o.value}
                id={`${listId}-${o.value}`}
                ref={i === active ? (el) => el?.scrollIntoView({ block: 'nearest' }) : undefined}
                tabIndex={-1}
                onKeyDown={handleKeyDown}
                role="option"
                aria-selected={o.value === selected}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => handlePick(o.value)}
                onPointerMove={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 ${i === active ? 'bg-line/50' : ''}`}
              >
                <Flag country={o.value} countryName={o.label} />
                <span className="flex-1 truncate">{o.label}</span>
                <span className="text-muted tabular-nums">+{getCountryCallingCode(o.value)}</span>
                <span
                  aria-hidden="true"
                  className={o.value === selected ? 'text-accent' : 'invisible'}
                >
                  ✓
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function matchCountries(
  real: { label: string; value: Country }[],
  query: string,
): { label: string; value: Country }[] {
  const q = query.trim().toLowerCase().replace(/^[+]/, '')
  return real.filter(
    (o) =>
      !q ||
      o.label.toLowerCase().includes(q) ||
      o.value.toLowerCase() === q ||
      getCountryCallingCode(o.value).startsWith(q),
  )
}

function matchesIndex(real: { value: Country }[], selected: Country | undefined): number {
  return real.findIndex((o) => o.value === selected)
}

/**
 * The storefront's phone field: a flag + calling code picker (searchable by country or code)
 * in front of a number box that formats as you type. The value is E.164. Styled with the
 * theme's tokens; the locked checkout passes its own box classes.
 */
export default function StorePhoneInput({
  value,
  onChange,
  onBlur,
  defaultCountry = 'IN',
  countries,
  searchPlaceholder = 'Search country or code',
  emptyText = 'No country found.',
  className = '',
  inputClassName = '',
  triggerClassName = '',
  disabled,
  ...props
}: StorePhoneInputProps) {
  // Render logic
  const initial = countries?.includes(defaultCountry)
    ? defaultCountry
    : (countries?.[0] ?? defaultCountry)

  return (
    <PhoneNumberInput
      className={`flex w-full rounded-[var(--radius-input,0.625rem)] ${className}`}
      // RPN reads undefined as "empty" but its types say string.
      value={toInputValue(value, initial) as string}
      onChange={(next?: string) => onChange(next ?? '')}
      onBlur={() => onBlur?.()}
      defaultCountry={initial}
      {...(countries ? { countries } : {})}
      metadata={METADATA}
      labels={labels}
      disabled={disabled ?? false}
      smartCaret={false}
      limitMaxLength
      international={false}
      flagComponent={Flag}
      inputComponent={NumberBox}
      countrySelectComponent={(
        p: Omit<CountrySelectProps, 'searchPlaceholder' | 'emptyText' | 'triggerClassName'>,
      ) => (
        <CountrySelect
          {...p}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
          triggerClassName={triggerClassName}
        />
      )}
      numberInputProps={{ className: inputClassName }}
      {...props}
    />
  )
}
