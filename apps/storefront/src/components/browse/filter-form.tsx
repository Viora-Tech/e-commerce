'use client'

import { formatPaise, Icon } from '@commerce/blocks'
import type { BrowseFacets, FacetValue } from '@commerce/core'
import { type BrowseFilters, FILTER_PARAM } from '@commerce/core/browse'
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
  filters,
  idPrefix,
}: FilterFormProps) {
  // Hooks
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
  const checks = (
    name: string,
    values: (FacetValue & { label?: string })[],
    picked: string[],
    key: string,
  ) =>
    values.map((v) => (
      <label
        key={`${key}-${v.value}`}
        className="flex cursor-pointer items-center gap-3 py-1 text-body"
      >
        <input
          type="checkbox"
          name={name}
          value={v.value}
          defaultChecked={picked.includes(v.value)}
          className="size-4 accent-[var(--color-ink)]"
        />
        <span className="flex-1">{v.label ?? v.value}</span>
        <span className="text-small text-muted">({v.count})</span>
      </label>
    ))
  const groups: { key: string; title: string; body: React.ReactNode; open: boolean }[] = []
  if (facets.inStock + facets.outOfStock > 0) {
    groups.push({
      key: 'availability',
      title: copy.availability,
      open: filters.available !== null,
      body: checks(
        FILTER_PARAM.available,
        [
          { value: '1', count: facets.inStock, label: copy.inStock },
          { value: '0', count: facets.outOfStock, label: copy.outOfStock },
        ],
        filters.available === null ? [] : [filters.available ? '1' : '0'],
        'avail',
      ),
    })
  }
  if (facets.priceMax !== null && facets.priceMax > 0) {
    groups.push({
      key: 'price',
      title: copy.price,
      open: filters.priceMin !== null || filters.priceMax !== null,
      body: (
        <div className="flex flex-col gap-2">
          <p className="text-small text-muted">{copy.priceRange(formatPaise(facets.priceMax))}</p>
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
                placeholder={String(Math.ceil(facets.priceMax / 100))}
                defaultValue={filters.priceMax === null ? '' : filters.priceMax / 100}
              />
            </label>
          </div>
        </div>
      ),
    })
  }
  for (const o of facets.options) {
    groups.push({
      key: `option-${o.key}`,
      title: o.name,
      open: (filters.options[o.key]?.length ?? 0) > 0,
      body: checks(
        `${FILTER_PARAM.optionPrefix}${o.key}`,
        o.values,
        filters.options[o.key] ?? [],
        o.key,
      ),
    })
  }
  if (facets.productTypes.length > 1) {
    groups.push({
      key: 'type',
      title: copy.productType,
      open: filters.productTypes.length > 0,
      body: checks(FILTER_PARAM.productType, facets.productTypes, filters.productTypes, 'type'),
    })
  }
  if (facets.vendors.length > 1) {
    groups.push({
      key: 'vendor',
      title: copy.vendor,
      open: filters.vendors.length > 0,
      body: checks(FILTER_PARAM.vendor, facets.vendors, filters.vendors, 'vendor'),
    })
  }
  if (facets.tags.length > 0) {
    groups.push({
      key: 'tag',
      title: copy.tag,
      open: filters.tags.length > 0,
      body: checks(FILTER_PARAM.tag, facets.tags.slice(0, 30), filters.tags, 'tag'),
    })
  }

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
        <details
          key={g.key}
          open={g.open || g.key === 'availability'}
          className="group border-b border-line py-4"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between text-body font-semibold [&::-webkit-details-marker]:hidden">
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
