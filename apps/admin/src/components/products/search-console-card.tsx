'use client'

import { isAlmostPageOne, isLowCtr, SEARCH_CONSOLE_APP_ID } from '@commerce/core/search-console'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import DeltaChip from '@/components/layout/delta-chip'
import { searchConsoleContent } from '@/data/search-console'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'

type SearchCard = Awaited<ReturnType<typeof api.searchConsole.product>>

type SearchConsoleCardProps = { productId: string }

/**
 * "Google search" on the product's SEO tab, from the Google Search Console app: the product's
 * clicks, views, click rate and position over the last 28 days and the searches that found it.
 * Nothing at all when the app is not installed (or the member cannot read the online store).
 */
export default function SearchConsoleCard({ productId }: SearchConsoleCardProps) {
  // Hooks
  const copy = useCopy(searchConsoleContent)
  const fmt = useFormat()
  const [card, setCard] = useState<SearchCard | null>(null)

  useEffect(() => {
    let cancelled = false
    api.searchConsole
      .product({ productId })
      .then((c) => !cancelled && setCard(c))
      .catch(() => !cancelled && setCard({ state: 'hidden' }))
    return () => {
      cancelled = true
    }
  }, [productId])

  // Early returns
  if (!card || card.state === 'hidden') return null

  // Render logic
  const p = copy.product

  return (
    <DataCard title={p.title} bodyClassName="flex flex-col gap-4">
      {card.state === 'not-connected' ? (
        <p className="text-body text-muted-foreground">
          {p.connect}{' '}
          <Link
            href={routes.apps.settings(SEARCH_CONSOLE_APP_ID)}
            className="font-medium text-foreground underline underline-offset-4"
          >
            {p.connectLink}
          </Link>
        </p>
      ) : card.stats.current.impressions === 0 ? (
        <p className="text-body text-muted-foreground">{p.notShown}</p>
      ) : (
        <>
          <p className="text-caption text-muted-foreground">{p.period}</p>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <dt className="text-caption text-muted-foreground">{p.clicks}</dt>
              <dd className="flex items-baseline gap-2 text-body-strong tabular-nums">
                {fmt.number(card.stats.current.clicks)}
                <DeltaChip delta={card.clickChange} />
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-caption text-muted-foreground">{p.views}</dt>
              <dd className="text-body-strong tabular-nums">
                {fmt.number(card.stats.current.impressions)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-caption text-muted-foreground">{p.ctr}</dt>
              <dd className="text-body-strong tabular-nums">
                {formatRate(card.stats.current.ctr)}
              </dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-caption text-muted-foreground">{p.position}</dt>
              <dd className="text-body-strong tabular-nums">
                {card.stats.current.position.toFixed(1)}
              </dd>
            </div>
          </dl>
          {isAlmostPageOne(card.stats.current) ? (
            <p className="rounded-lg surface-banner px-3 py-2 text-body">{p.almostPageOne}</p>
          ) : isLowCtr(card.stats.current) ? (
            <p className="rounded-lg surface-banner px-3 py-2 text-body">{p.lowCtr}</p>
          ) : null}
          <div className="flex flex-col gap-2">
            <span className="text-body-strong">{p.queries}</span>
            {card.stats.queries.length === 0 ? (
              <p className="text-body text-muted-foreground">{p.noQueries}</p>
            ) : (
              <ul className="flex flex-col">
                {card.stats.queries.map((q) => (
                  <li
                    key={q.query}
                    className="flex items-baseline justify-between gap-3 border-border-soft border-b py-1.5 last:border-b-0"
                  >
                    <span className="min-w-0 truncate text-body">{q.query}</span>
                    <span className="shrink-0 text-caption text-muted-foreground tabular-nums">
                      {p.queryLine(fmt.number(q.clicks), fmt.number(q.impressions))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </DataCard>
  )
}
