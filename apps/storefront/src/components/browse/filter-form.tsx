'use client'

import { Icon, useFormatPaise } from '@commerce/blocks'
import type { BrowseFacets } from '@commerce/core'
import { type BrowseFilters, FILTER_PARAM, pickedValues } from '@commerce/core/browse'
import {
  type FilterSource,
  type ResolvedFilterGroup,
  resolveFilterGroups,
  type StorefrontFilterConfig,
} from '@commerce/core/filter-config'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'
import { browseContent as copy } from '@/data/browse'

type FilterFormProps = {
  /** Path the form submits to (`/collections/x`, `/search`). */
  action: string
  q?: string | undefined
  /** Non-default sort to keep; null when the listing's default is in force. */
  sort: string | null
  facets: BrowseFacets
  /** The store's filter settings: which groups show, in what order; null for the default. */
  config: StorefrontFilterConfig | null
  filters: BrowseFilters
  /** Keeps ids unique when the form renders twice (sidebar and drawer). */
  idPrefix: string
}

/** Form data to a clean URL: blank prices and the default page are dropped. */
function urlFor(form: HTMLFormElement): string {
  const data = new FormData(form)
  const params = new URLSearchParams()
  for (const [k, v] of data.entries()) {
    if (typeof v === 'string' && v.trim() !== '') params.append(k, v)
  }
  const qs = params.toString()
  return qs ? `${form.getAttribute('action')}?${qs}` : (form.getAttribute('action') ?? '')
}

/** The drawer's name for a group the merchant did not name. */
const DEFAULT_TITLE: Partial<Record<FilterSource, string>> = {
  availability: copy.availability,
  giftCard: copy.kind,
  price: copy.price,
  productType: copy.productType,
  vendor: copy.vendor,
  tags: copy.tag,
}

/** Labels for values that are codes in the URL (`1` / `0`). */
function valueLabel(g: ResolvedFilterGroup, value: string): string | undefined {
  if (g.source === 'availability') return value === '1' ? copy.inStock : copy.outOfStock
  if (g.source === 'giftCard') return value === '1' ? copy.kindGiftCards : copy.kindProducts
  if (g.type === 'boolean') return value === '1' ? copy.yes : copy.no
  return undefined
}

/**
 * Facet filters as a plain GET form, so it works before (or without) JavaScript;
 * once hydrated, every tick navigates straight away and Apply is only needed for
 * the price inputs.
 */
export default function FilterForm({
  action,
  q,
  sort,
  facets,
  config,
  filters,
  idPrefix,
}: FilterFormProps) {
  // Hooks
  const formatPaise = useFormatPaise()
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  // Event handlers
  const handleChange = (e: React.ChangeEvent<HTMLFormElement>) => {
    // Prices apply on blur or Apply, not on every keystroke.
    if (e.target instanceof HTMLInputElement && e.target.type === 'number') return
    if (formRef.current) router.push(urlFor(formRef.current), { scroll: false })
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    router.push(urlFor(e.currentTarget), { scroll: false })
  }

  // Render logic
  const id = (s: string) => `${idPrefix}-${s}`
  const checks = (g: ResolvedFilterGroup, picked: string[]) =>
    g.values.map((v) => (
      <label
        key={`${g.id}-${v.value}`}
        className="flex cursor-pointer items-center gap-3 py-1 text-small text-ink"
      >
        <input
          type="checkbox"
          name={g.param}
          value={v.value}
          defaultChecked={picked.includes(v.value)}
          className="size-4 accent-[var(--color-ink)]"
        />
        <span className="flex-1">{v.label ?? valueLabel(g, v.value) ?? v.value}</span>
        <span className="text-small text-muted">({v.count})</span>
      </label>
    ))
  const priceBody = (priceMax: number) => (
    <div className="flex flex-col gap-2">
      <p className="text-small text-muted">{copy.priceRange(formatPaise(priceMax))}</p>
      <div className="flex items-center gap-3">
        <label className="field min-w-0 flex-1" htmlFor={id('min')}>
          <span className="field__label text-small">{copy.priceFrom}</span>
          <input
            id={id('min')}
            className="field__input w-full min-w-0"
            type="number"
            min={0}
            inputMode="numeric"
            name={FILTER_PARAM.priceMin}
            placeholder="0"
            defaultValue={filters.priceMin === null ? '' : filters.priceMin / 100}
          />
        </label>
        <label className="field min-w-0 flex-1" htmlFor={id('max')}>
          <span className="field__label text-small">{copy.priceTo}</span>
          <input
            id={id('max')}
            className="field__input w-full min-w-0"
            type="number"
            min={0}
            inputMode="numeric"
            name={FILTER_PARAM.priceMax}
            placeholder={String(Math.ceil(priceMax / 100))}
            defaultValue={filters.priceMax === null ? '' : filters.priceMax / 100}
          />
        </label>
      </div>
    </div>
  )
  const groups = resolveFilterGroups(facets, config, 'theme').map((g) => {
    const picked = pickedValues(filters, g.slot)
    const price = g.type === 'price_range'
    return {
      key: g.id,
      title: g.label ?? DEFAULT_TITLE[g.source] ?? g.id,
      open:
        g.source === 'availability' ||
        (price ? filters.priceMin !== null || filters.priceMax !== null : picked.length > 0),
      body: price ? priceBody(g.priceMax ?? 0) : checks(g, picked),
    }
  })

  return (
    <form
      ref={formRef}
      action={action}
      method="get"
      onChange={handleChange}
      onSubmit={handleSubmit}
      className="flex flex-col"
    >
      {q ? <input type="hidden" name="q" value={q} /> : null}
      {sort ? <input type="hidden" name="sort_by" value={sort} /> : null}
      {groups.map((g) => (
        <details key={g.key} open={g.open} className="group border-b border-line py-4">
          <summary className="flex cursor-pointer list-none items-center justify-between text-body font-medium text-ink [&::-webkit-details-marker]:hidden">
            {g.title}
            <span aria-hidden="true" className="transition-transform group-open:rotate-180">
              <Icon name="chevron-down" size={16} />
            </span>
          </summary>
          <div className="flex flex-col gap-1 pt-3">{g.body}</div>
        </details>
      ))}
      <button type="submit" className="btn btn--secondary btn--small mt-6 w-full">
        {copy.apply}
      </button>
    </form>
  )
}
