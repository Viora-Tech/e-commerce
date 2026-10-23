'use client'

import { type CatalogueApp, filterCatalogue } from '@commerce/core/app-catalogue'
import { Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { categoryCopy, categoryPath, appsContent as copy } from '@/data/apps'
import AppCard from '../apps/app-card'
import ChoiceChip from '../common/choice-chip'
import PageContainer from '../common/page-container'

type AppDirectoryProps = {
  apps: CatalogueApp[]
  categories: { slug: string; count: number }[]
  /** On a category page: that category, its chip shown as current. */
  category?: string | null
}

type Price = 'all' | 'free' | 'paid'
const PRICES: Price[] = ['all', 'free', 'paid']

const NAV_LINK =
  'flex h-9 items-center justify-between gap-3 rounded-xl px-3 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

/** `?q=courier&price=free&ours=1`: the filters a shared link opens with. */
function readParams(): { query: string; price: Price; ours: boolean } {
  const params = new URLSearchParams(window.location.search)
  const price = params.get('price')
  return {
    query: params.get('q') ?? '',
    price: price === 'free' || price === 'paid' ? price : 'all',
    ours: params.get('ours') === '1',
  }
}

/**
 * The App Store directory: category links down the side (each a static page), then search, a
 * price filter and "Built by us" over the grid. Every app is in the built HTML; the filters only
 * narrow it in the browser and are kept in the address so a link opens the same view.
 */
export default function AppDirectory({ apps, categories, category = null }: AppDirectoryProps) {
  // Hooks
  const [query, setQuery] = useState('')
  const [price, setPrice] = useState<Price>('all')
  const [ours, setOurs] = useState(false)

  useEffect(() => {
    const initial = readParams()
    setQuery(initial.query)
    setPrice(initial.price)
    setOurs(initial.ours)
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    if (query.trim()) params.set('q', query.trim())
    if (price !== 'all') params.set('price', price)
    if (ours) params.set('ours', '1')
    const search = params.toString()
    const next = `${window.location.pathname}${search ? `?${search}` : ''}`
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, '', next)
    }
  }, [query, price, ours])

  // Event handlers
  const handleClear = () => {
    setQuery('')
    setPrice('all')
    setOurs(false)
  }

  // Render logic
  const visible = filterCatalogue(apps, { query, category, price, ours })
  const total = categories.reduce((sum, c) => sum + c.count, 0)
  const rows = [
    { href: '/apps', label: copy.allApps, count: total, current: category === null },
    ...categories.map((c) => ({
      href: categoryPath(c.slug),
      label: categoryCopy(c.slug).label,
      count: c.count,
      current: category === c.slug,
    })),
  ]

  return (
    <PageContainer className="flex flex-col gap-8 lg:flex-row lg:items-start lg:gap-10">
      <nav aria-label={copy.categoriesLabel} className="lg:sticky lg:top-24 lg:w-56 lg:shrink-0">
        <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {rows.map((row) => (
            <li key={row.href} className="shrink-0">
              <Link
                href={row.href}
                aria-current={row.current ? 'page' : undefined}
                className={cn(
                  NAV_LINK,
                  row.current
                    ? 'bg-foreground font-medium text-background'
                    : 'text-muted-foreground hover:bg-card hover:text-foreground',
                )}
              >
                {row.label}
                <span className="text-xs opacity-70">{row.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.search}
              className="h-10 pl-9 text-base md:text-sm"
            />
          </div>
          <fieldset
            aria-label={copy.filtersLabel}
            className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0"
          >
            {PRICES.map((p) => (
              <ChoiceChip
                key={p}
                label={copy.price[p]}
                selected={price === p}
                onSelect={() => setPrice(p)}
              />
            ))}
            <ChoiceChip label={copy.ours} selected={ours} onSelect={() => setOurs(!ours)} />
          </fieldset>
        </div>

        <p className="text-sm text-muted-foreground" aria-live="polite">
          {copy.results(visible.length)}
        </p>

        {visible.length === 0 ? (
          <div className="surface-card flex flex-col items-start gap-3 rounded-2xl p-8">
            <h2 className="text-lg font-semibold text-foreground">{copy.noResultsTitle}</h2>
            <p className="text-sm text-muted-foreground">{copy.noResultsBody}</p>
            <button
              type="button"
              onClick={handleClear}
              className="text-sm font-medium text-foreground underline-offset-2 hover:underline"
            >
              {copy.clear}
            </button>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((app) => (
              <li key={app.id}>
                <AppCard app={app} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageContainer>
  )
}
