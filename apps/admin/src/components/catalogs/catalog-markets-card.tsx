'use client'

import type { CatalogSummary, MarketView } from '@commerce/core'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { catalogsContent } from '@/data/catalogs'
import { useCopy } from '@/hooks/use-copy'

type CatalogMarketsCardProps = {
  /** The catalog being edited; null while it is new. */
  catalogId: string | null
  markets: MarketView[]
  /** Every catalog, to name the one a market uses now. */
  catalogs: CatalogSummary[]
  marketIds: string[]
  disabled: boolean
  onChange: (marketIds: string[]) => void
}

/** The markets that sell from this catalog, one tick each; a market uses one catalog. */
export default function CatalogMarketsCard({
  catalogId,
  markets,
  catalogs,
  marketIds,
  disabled,
  onChange,
}: CatalogMarketsCardProps) {
  // Hooks
  const { form: copy } = useCopy(catalogsContent)

  // Event handlers
  const handleToggle = (id: string, on: boolean) =>
    onChange(on ? [...marketIds, id] : marketIds.filter((m) => m !== id))

  return (
    <DataCard title={copy.markets} subtitle={copy.marketsHelp}>
      {markets.length === 0 ? (
        <p className="text-body text-muted-foreground">{copy.noMarketsYet}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {markets.map((m) => {
            const picked = marketIds.includes(m.id)
            const other =
              m.catalogId && m.catalogId !== catalogId
                ? (catalogs.find((c) => c.id === m.catalogId)?.name ?? null)
                : null
            return (
              <li key={m.id}>
                <label htmlFor={`catalog-market-${m.id}`} className="flex items-start gap-2">
                  <Checkbox
                    id={`catalog-market-${m.id}`}
                    className="mt-0.5"
                    checked={picked}
                    disabled={disabled}
                    onCheckedChange={(on) => handleToggle(m.id, on === true)}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="flex flex-wrap items-center gap-2 text-body">
                      {m.name}
                      <StatusChip>{m.currency}</StatusChip>
                    </span>
                    {m.currency === 'INR' ? (
                      <span className="text-caption text-muted-foreground">{copy.rupeeMarket}</span>
                    ) : null}
                    {other && !picked ? (
                      <span className="text-caption text-muted-foreground">
                        {copy.usesOther(other)}
                      </span>
                    ) : null}
                    {other && picked ? (
                      <span className="text-caption text-muted-foreground">
                        {copy.movesFrom(other)}
                      </span>
                    ) : null}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </DataCard>
  )
}
