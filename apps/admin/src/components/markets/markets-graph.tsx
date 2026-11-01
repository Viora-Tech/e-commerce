'use client'

import type { CatalogSummary, DomainView, MarketView } from '@commerce/core'
import { Earth, Store } from '@commerce/ui/icons'
import Link from 'next/link'
import type { StoreDefaults } from '@/app/(admin)/markets/load'
import StatusChip from '@/components/layout/status-chip'
import { marketsContent } from '@/data/markets'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { marketOverrides } from './market-overrides'

type MarketsGraphProps = {
  /** Every market, the primary one first. */
  markets: MarketView[]
  domains: DomainView[]
  catalogs: CatalogSummary[]
  defaults: StoreDefaults
}

/**
 * One curve from the middle of the store defaults card (left edge, y 50) to the middle of the
 * market card in row `i` of `n`. The SVG is stretched to the column, so 0–100 on both axes.
 */
function linkPath(i: number, n: number): string {
  const y = ((i + 0.5) * 100) / n
  return `M 0 50 C 50 50, 50 ${y}, 100 ${y}`
}

/**
 * Markets › Graph view (audit #117): the store defaults card, with a line drawn to each market's
 * card, and on each market card only what it changes. Side by side on a wide screen; on a phone
 * the markets stack under the defaults on a rail. Plain SVG for the lines, no graph library.
 */
export default function MarketsGraph({ markets, domains, catalogs, defaults }: MarketsGraphProps) {
  // Hooks
  const copy = useCopy(marketsContent)

  // Helpers
  const languageName = (code: string) => copy.languages[code] ?? code
  const catalogName = (id: string) => catalogs.find((c) => c.id === id)?.name ?? null

  // Render logic
  const g = copy.graph
  const primary = markets.find((m) => m.isPrimary)
  const others = markets.filter((m) => !m.isPrimary)
  const primaryHost = domains.find((d) => d.isPrimary)?.hostname ?? ''
  const currency = primary?.currency ?? 'INR'
  const defaultRows = [
    { key: 'domain', label: g.rows.domain, value: primaryHost || copy.choice },
    {
      key: 'language',
      label: g.rows.language,
      value: (primary ? [primary.locale, ...primary.locales] : ['en']).map(languageName).join(', '),
    },
    { key: 'products', label: g.rows.products, value: g.products(defaults.productCount) },
    {
      key: 'currency',
      label: g.rows.currency,
      value: `${currency} · ${copy.currencies[currency] ?? currency}`,
    },
    { key: 'discounts', label: g.rows.discounts, value: g.discounts(defaults.discountCount) },
    { key: 'entity', label: g.rows.entity, value: defaults.legalName ?? g.entityNone },
    { key: 'checkout', label: g.rows.checkout, value: g.checkout },
    { key: 'taxes', label: g.rows.taxes, value: g.taxes(defaults.gstRatePercent) },
    { key: 'returns', label: g.rows.returns, value: g.returns },
  ]

  return (
    <div className="flex flex-col gap-0 lg:flex-row lg:items-stretch">
      <section
        aria-labelledby="store-defaults"
        className="flex flex-col gap-3 self-stretch rounded-xl border border-line bg-card p-4 shadow-card lg:w-80 lg:shrink-0 lg:self-center"
      >
        <header className="flex items-center gap-2">
          <Store aria-hidden="true" className="size-4 text-muted-foreground" />
          <h2 id="store-defaults" className="font-medium text-ink-strong">
            {g.defaults}
          </h2>
        </header>
        <p className="text-caption text-muted-foreground">
          {g.defaultsNote(primary?.name ?? copy.primary)}
        </p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-caption">
          {defaultRows.map((row) => (
            <div key={row.key} className="contents">
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0 truncate text-ink-strong">{row.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {others.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line p-4 text-body text-muted-foreground lg:mt-0 lg:ml-8 lg:self-center">
          {g.empty}
        </p>
      ) : (
        <>
          {/* The lines: only beside each other, where the cards sit in rows of equal height. */}
          <div aria-hidden="true" className="hidden w-20 shrink-0 text-line lg:block">
            <svg
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              className="size-full"
              role="presentation"
            >
              {others.map((m, i) => (
                <path
                  key={m.id}
                  d={linkPath(i, others.length)}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          </div>
          {/* A rail on a phone: a short line down from the defaults, then a tick to each card. */}
          <span aria-hidden="true" className="ml-6 h-4 w-px bg-line lg:hidden" />
          <ul className="ml-6 grid min-w-0 flex-1 auto-rows-fr border-line border-l pl-4 lg:ml-0 lg:border-l-0 lg:pl-0">
            {others.map((m) => {
              const overrides = marketOverrides(m, primary, {
                primaryHost,
                catalogName,
                languageName,
              })
              return (
                <li key={m.id} className="relative flex items-center py-1.5">
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 -left-4 h-px w-4 bg-line lg:hidden"
                  />
                  <Link
                    href={routes.markets.detail(m.id)}
                    className="flex w-full min-w-0 flex-col gap-2 rounded-xl border border-line bg-card p-3.5 shadow-card motion-press hover:shadow-card-hover focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Earth aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium text-ink-strong">{m.name}</span>
                      <span className="shrink-0 text-caption text-muted-foreground">
                        {g.countries(m.countries.length)}
                      </span>
                      {m.enabled ? null : <StatusChip>{g.off}</StatusChip>}
                    </span>
                    {overrides.length === 0 ? (
                      <span className="text-caption text-muted-foreground">{g.noOverrides}</span>
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {overrides.map((o) => (
                          <span
                            key={o.key}
                            className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-caption"
                          >
                            <span className="text-muted-foreground">{g.override[o.key]}</span>
                            <span className="truncate text-ink-strong">{o.value}</span>
                          </span>
                        ))}
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
