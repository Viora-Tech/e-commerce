'use client'

import { useState } from 'react'
import RadioDot from '@/components/checkout/radio-dot'
import { deliveryOptionsContent as appCopy } from '@/data/delivery-options'
import { CK_PICKED } from '@/lib/checkout-classes'
import type { CourierLogo } from '@/lib/delivery-options'

type CourierRow = {
  routeKey: string
  label: string
  pricePaise: number
  arrives: string | null
  logo: CourierLogo | null
  earliest?: string | null | undefined
}

type CourierListProps = {
  optionId: string
  choices: CourierRow[]
  /** The picked courier's route key; null: none of these is picked. */
  selected: string | null
  onPick: (routeKey: string) => void
  /** "₹49", or "Free". */
  price: (paise: number) => string
  /** "₹29", for the "+ ₹29" a dearer courier adds. */
  money: (paise: number) => string
  /** The fact line after the date ("By air · order in the next 2 h"), per row. */
  note: (index: number) => string | null
  /** Said once above the rows (cash on delivery on every courier); null: nothing to say. */
  heading: string | null
  /** The first row is a product rule's preferred courier: tagged Recommended, not Cheapest. */
  preferred?: boolean
}

/** Rows shown before "Show N more couriers". */
export const COURIERS_SHOWN = 3

/**
 * The row tagged Fastest: the first (cheapest, rows come cheapest first) of those arriving on
 * the earliest day; -1 when no date is known, or when every row arrives that day (no news).
 */
export function fastestIndex(rows: ReadonlyArray<{ earliest?: string | null | undefined }>) {
  const known = rows.map((r) => r.earliest ?? null)
  const first = known.filter((e): e is string => e !== null).sort()[0]
  if (!first || known.every((e) => e === first)) return -1
  return known.indexOf(first)
}

/** The right-hand side: the first (included) courier's price, then what each other one adds. */
export function rowPrice(
  i: number,
  pricePaise: number,
  basePaise: number,
  price: (paise: number) => string,
  money: (paise: number) => string,
): string {
  // Owner, 20 Nov 2026: a courier at the included price shows that price, not "Same price".
  const extra = pricePaise - basePaise
  return i > 0 && extra > 0 ? `+ ${money(extra)}` : price(pricePaise)
}

function Tag({ children }: { children: string }) {
  return (
    <span className="rounded-[0.3125rem] bg-ck-soft px-1.5 text-[0.6875rem] leading-[1.125rem] font-medium text-ck-muted">
      {children}
    </span>
  )
}

function Logo({ logo }: { logo: CourierLogo | null }) {
  if (!logo) return <span className="size-8 shrink-0 rounded-[0.5rem] bg-ck-soft" />
  return (
    <span
      className={`grid size-8 shrink-0 place-items-center overflow-hidden rounded-[0.5rem] ${logo.light ? 'bg-white px-0.5' : ''}`}
    >
      {logo.src ? (
        // biome-ignore lint/performance/noImgElement: a 32px static logo from /public.
        <img src={logo.src} alt={logo.alt} className="max-h-6 max-w-full object-contain" />
      ) : (
        <span
          role="img"
          aria-label={logo.alt}
          className="grid size-full place-items-center bg-ck-soft text-[0.6875rem] font-semibold text-ck-ink"
        >
          {logo.initials}
        </span>
      )}
    </span>
  )
}

/**
 * The Delivery options app's courier list at checkout (owner, 20 Nov 2026): one compact row per
 * courier in a single box (logo, name, date, price), Cheapest and Fastest tagged, cash on
 * delivery said once above, and only the first three until the shopper asks for the rest. The
 * first courier is included at its price; the others show what they add.
 */
export default function CourierList({
  optionId,
  choices,
  selected,
  onPick,
  price,
  money,
  note,
  heading,
  preferred = false,
}: CourierListProps) {
  // Hooks
  const [open, setOpen] = useState(false)

  // Handlers
  const handleToggle = () => setOpen((v) => !v)

  // Render logic
  // A picked courier past the first three keeps the list open, so the pick never hides.
  const pickedAt = choices.findIndex((c) => c.routeKey === selected)
  const base = choices[0]?.pricePaise ?? 0
  const fastest = fastestIndex(choices)
  const hidden = Math.max(0, choices.length - COURIERS_SHOWN)
  const rows = open || pickedAt >= COURIERS_SHOWN ? choices : choices.slice(0, COURIERS_SHOWN)

  return (
    <div className="flex flex-col gap-2">
      {heading ? <p className="text-[0.8125rem] text-ck-muted">{heading}</p> : null}
      <div className="flex flex-col overflow-hidden rounded-ck border border-ck-line-strong bg-ck-bg">
        {rows.map((c, i) => {
          const on = c.routeKey === selected
          const fact = note(i)
          return (
            <label
              key={`${optionId}:${c.routeKey}`}
              className={`flex cursor-pointer items-center gap-3 border-b border-ck-line-strong px-3.5 py-2.5 first:rounded-t-[calc(var(--ck-radius)-1px)] last:rounded-b-[calc(var(--ck-radius)-1px)] transition-[background-color,box-shadow] duration-150 ease-out last:border-b-0 has-[:focus-visible]:[box-shadow:inset_0_0_0_2px_var(--ck-accent)] motion-reduce:transition-none ${on ? CK_PICKED : 'hover:bg-ck-soft/50'}`}
            >
              <input
                type="radio"
                name="shipping-rate"
                value={`${optionId}:${c.routeKey}`}
                checked={on}
                onChange={() => onPick(c.routeKey)}
                className="peer sr-only"
              />
              <RadioDot checked={on} />
              <Logo logo={c.logo} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-1.5 text-[0.9375rem] leading-5 font-semibold text-ck-ink">
                  {c.label}
                  {i === 0 ? <Tag>{preferred ? appCopy.recommended : appCopy.cheapest}</Tag> : null}
                  {i === fastest ? <Tag>{appCopy.fastest}</Tag> : null}
                </span>
                <span className="text-[0.8125rem] leading-[1.125rem] text-ck-muted">
                  <span className={on ? 'font-medium text-ck-success' : ''}>{c.arrives}</span>
                  {c.arrives && fact ? ' · ' : ''}
                  {fact}
                </span>
              </span>
              <span className="shrink-0 text-right text-[0.875rem] font-semibold tabular-nums text-ck-ink">
                {rowPrice(i, c.pricePaise, base, price, money)}
              </span>
            </label>
          )
        })}
      </div>
      {hidden > 0 && pickedAt < COURIERS_SHOWN ? (
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={open}
          className="flex w-full items-center justify-center gap-1.5 rounded-ck border border-dashed border-ck-line-strong bg-ck-soft/40 px-3.5 py-2.5 text-[0.875rem] font-semibold text-ck-ink transition-colors duration-150 hover:border-ck-accent-lift hover:bg-ck-accent-soft focus-visible:outline-2 focus-visible:outline-ck-accent motion-reduce:transition-none"
        >
          {open ? appCopy.showLess : appCopy.showMore(hidden)}
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className={`size-4 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
          >
            <path
              d="M4 6l4 4 4-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
