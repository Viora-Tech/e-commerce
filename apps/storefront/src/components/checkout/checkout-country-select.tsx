'use client'

import Image from 'next/image'
import { type KeyboardEvent, useEffect, useRef, useState } from 'react'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent } from '@/data/checkout'
import { CK_INPUT, CK_INPUT_HEIGHT, CK_LABEL } from '@/lib/checkout-classes'

type CheckoutCountrySelectProps = {
  id: string
  label: string
  value: string
  options: readonly (readonly [string, string])[]
  onChange: (value: string) => void
}

const content = checkoutContent.countryPicker
const LIST_ID = 'checkout-country-list'

/** The country's flag: a small file per country, so only the flags on screen ever load. */
function Flag({ code }: { code: string }) {
  return (
    <Image
      src={`/flags/${code}.svg`}
      alt=""
      width={24}
      height={16}
      unoptimized
      className="block h-4! w-6! shrink-0 rounded-[0.1875rem] [box-shadow:0_0_0_0.0625rem_var(--ck-line)]"
    />
  )
}

/** The countries a search keeps: by name, or by exact code. */
function matching(
  options: CheckoutCountrySelectProps['options'],
  query: string,
): CheckoutCountrySelectProps['options'] {
  const needle = query.trim().toLowerCase()
  if (!needle) return options
  return options.filter(
    ([code, name]) => name.toLowerCase().includes(needle) || code.toLowerCase() === needle,
  )
}

/**
 * The Country field: a button that opens a searchable list, each country with its flag. Type to narrow it, arrows to move, Enter to pick, Escape to close. A hidden native
 * select stays in the page so the browser can still autofill the country.
 */
export default function CheckoutCountrySelect({
  id,
  label,
  value,
  options,
  onChange,
}: CheckoutCountrySelectProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    search.current?.focus()
    const close = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  // Event handlers
  const handleOpen = () => {
    setQuery('')
    setActive(
      Math.max(
        0,
        options.findIndex(([code]) => code === value),
      ),
    )
    setOpen((was) => !was)
  }
  const handlePick = (code: string) => {
    onChange(code)
    setOpen(false)
    trigger.current?.focus()
  }
  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, matching(options, query).length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      // The list sits inside the checkout's form: Enter picks, it never submits.
      e.preventDefault()
      const pick = matching(options, query)[active]
      if (pick) handlePick(pick[0])
    }
  }

  // Render logic
  const shown = matching(options, query)
  const current = options.find(([code]) => code === value)

  return (
    <div ref={root} className="relative flex min-w-0 flex-col gap-2">
      <span id={`${id}-label`} className={CK_LABEL}>
        {label}
      </span>
      <select
        aria-hidden="true"
        tabIndex={-1}
        name={id}
        autoComplete="country"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      >
        {options.map(([code, name]) => (
          <option key={code} value={code}>
            {name}
          </option>
        ))}
      </select>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby={`${id}-label ${id}`}
        onClick={handleOpen}
        className={`${CK_INPUT} ${CK_INPUT_HEIGHT} flex cursor-pointer items-center gap-2.5 border! border-ck-line! bg-ck-field! text-left`}
      >
        <Flag code={value} />
        <span className="min-w-0 flex-1 truncate">{current?.[1] ?? value}</span>
        <CheckoutIcon name="chevron" className="size-4 shrink-0 text-ck-muted" />
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-full z-20 mt-1 flex flex-col overflow-hidden rounded-ck bg-ck-bg [box-shadow:var(--ck-section-shadow)]">
          <div className="flex items-center gap-2 border-b border-ck-line px-3.5">
            <CheckoutIcon name="search" className="size-4 shrink-0 text-ck-muted" />
            <input
              ref={search}
              type="text"
              role="combobox"
              aria-controls={LIST_ID}
              aria-expanded="true"
              aria-activedescendant={shown[active] ? `${LIST_ID}-${shown[active][0]}` : undefined}
              aria-label={content.search}
              placeholder={content.search}
              autoComplete="off"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={handleKey}
              className="h-11 min-w-0 flex-1 bg-transparent! text-[1rem]! text-ck-ink! outline-none placeholder:text-ck-faint lg:text-[0.9375rem]!"
            />
          </div>
          <div
            id={LIST_ID}
            role="listbox"
            aria-label={label}
            className="max-h-60 overflow-y-auto p-1"
          >
            {shown.map(([code, name], i) => (
              <div
                key={code}
                id={`${LIST_ID}-${code}`}
                role="option"
                tabIndex={-1}
                aria-selected={code === value}
                onPointerEnter={() => setActive(i)}
                onClick={() => handlePick(code)}
                onKeyDown={undefined}
                className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[0.5rem] px-2.5 text-[0.9375rem] text-ck-ink ${i === active ? 'bg-ck-soft' : ''}`}
              >
                <Flag code={code} />
                <span className="min-w-0 flex-1 truncate">{name}</span>
                {code === value ? (
                  <CheckoutIcon name="check" className="size-4 shrink-0 text-ck-accent-lift" />
                ) : null}
              </div>
            ))}
            {shown.length === 0 ? (
              <p className="px-2.5 py-3 text-[0.875rem] text-ck-muted">{content.empty}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
