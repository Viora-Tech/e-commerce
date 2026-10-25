'use client'

import { type CatalogueApp, filterCatalogue } from '@commerce/core/app-catalogue'
import { type ReactNode, useEffect, useState } from 'react'
import { appCollections, appsContent as copy } from '@/data/apps'
import AppCard from '../apps/app-card'
import CategoryChips from '../apps/category-chips'
import CategorySections from '../apps/category-sections'
import DirectoryEmpty from '../apps/directory-empty'
import DirectorySearch from '../apps/directory-search'
import ChoiceChip from '../common/choice-chip'
import PageContainer from '../common/page-container'

type AppDirectoryProps = {
  apps: CatalogueApp[]
  categories: { slug: string; count: number }[]
  /** On a category page: that category, its chip shown as current. */
  category?: string | null
  title: string
  body: string
  /** The hero's right side (the icon wall on the front page). */
  aside?: ReactNode
  /** Shown above the category shelves while nothing is filtered (the Essentials stack). */
  featured?: ReactNode
}

type Price = 'all' | 'free' | 'paid'
const PRICES: Price[] = ['all', 'free', 'paid']

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
 * The App Store directory. The hero holds the search (it filters as you type) and the category
 * chips; below, the front page shows the Essentials stack, our own apps and every category's
 * shelf, and as soon as anything is filtered it becomes one grid of matches. Every app is in the
 * built HTML; the filters only narrow it in the browser and are kept in the address.
 */
export default function AppDirectory({
  apps,
  categories,
  category = null,
  title,
  body,
  aside,
  featured,
}: AppDirectoryProps) {
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
      window.history.replaceState(window.history.state, '', next)
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
  const browsing = category === null && !query.trim() && price === 'all' && !ours
  const ourApps = apps.filter((a) => a.kind === 'builtin')

  return (
    <>
      <PageContainer
        as="section"
        className="grid items-center gap-10 pt-14 pb-12 md:pt-20 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-16 lg:pb-16"
      >
        <div className="flex min-w-0 flex-col gap-7">
          <div className="flex flex-col gap-4">
            <h1 className="max-w-3xl text-5xl font-semibold tracking-[-0.045em] text-balance text-foreground md:text-display">
              {title}
            </h1>
            <p className="max-w-xl text-lead text-pretty text-muted-foreground">{body}</p>
          </div>
          <DirectorySearch value={query} onChange={setQuery} />
          <CategoryChips categories={categories} current={category} query={query} />
        </div>
        {aside}
      </PageContainer>

      <PageContainer className="flex flex-col gap-8">
        <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground tabular-nums" aria-live="polite">
            {copy.results(visible.length)}
          </p>
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

        {browsing ? (
          <div className="flex flex-col gap-16 md:gap-24">
            {featured}
            {ourApps.length > 0 ? (
              <section aria-labelledby="ours-title" className="flex flex-col gap-6">
                <div className="flex max-w-2xl flex-col gap-1.5">
                  <h2
                    id="ours-title"
                    className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl"
                  >
                    {appCollections.ours.title}
                  </h2>
                  <p className="text-sm text-pretty text-muted-foreground">
                    {appCollections.ours.body}
                  </p>
                </div>
                <ul className="no-scrollbar -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 md:-mx-8 md:scroll-px-8 md:px-8">
                  {ourApps.map((app) => (
                    <li key={app.id} className="shrink-0 snap-start">
                      <AppCard app={app} variant="row" />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <CategorySections apps={apps} categories={categories} />
          </div>
        ) : visible.length === 0 ? (
          <DirectoryEmpty query={query} onSuggest={setQuery} onClear={handleClear} />
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((app) => (
              <li key={app.id}>
                <AppCard app={app} />
              </li>
            ))}
          </ul>
        )}
      </PageContainer>
    </>
  )
}
