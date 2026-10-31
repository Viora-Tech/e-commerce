'use client'

import type { CatalogSummary, MarketView } from '@commerce/core'
import { Globe, XIcon } from '@commerce/ui/icons'
import ActionMenu from '@/components/layout/action-menu'
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

/**
 * The markets that sell from this catalog, as Shopify's row: a chip per market with a remove
 * button, and "Add market" for the rest. A market uses one catalog, so a note says which
 * catalog a picked market leaves.
 */
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

  // Render logic
  const otherCatalog = (m: MarketView) =>
    m.catalogId && m.catalogId !== catalogId
      ? (catalogs.find((c) => c.id === m.catalogId)?.name ?? null)
      : null
  const picked = markets.filter((m) => marketIds.includes(m.id))
  const rest = markets.filter((m) => !marketIds.includes(m.id))
  const moves = picked.flatMap((m) => {
    const other = otherCatalog(m)
    return other ? [`${m.name}: ${copy.movesFrom(other)}`] : []
  })

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-start">
      <span className="w-40 shrink-0 pt-1 text-body font-medium text-ink-strong">
        {copy.markets}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {markets.length === 0 ? (
          <p className="pt-1 text-body text-muted-foreground">{copy.noMarketsYet}</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {picked.map((m) => (
              <span
                key={m.id}
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-secondary pr-1 pl-2 text-body text-ink-strong"
              >
                <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
                {m.name}
                <span className="text-caption text-muted-foreground">{m.currency}</span>
                <button
                  type="button"
                  aria-label={copy.remove(m.name)}
                  disabled={disabled}
                  className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                  onClick={() => onChange(marketIds.filter((id) => id !== m.id))}
                >
                  <XIcon className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
            {rest.length > 0 ? (
              <ActionMenu
                label={copy.addMarket}
                trigger="button"
                variant="outline"
                size="sm"
                align="start"
                disabled={disabled}
                items={rest.map((m) => {
                  const other = otherCatalog(m)
                  return {
                    label: other ? `${m.name} · ${copy.usesOther(other)}` : m.name,
                    icon: Globe,
                    onSelect: () => onChange([...marketIds, m.id]),
                  }
                })}
              />
            ) : null}
          </div>
        )}
        {picked.some((m) => m.currency === 'INR') ? (
          <p className="text-caption text-muted-foreground">{copy.rupeeMarket}</p>
        ) : null}
        {moves.map((note) => (
          <p key={note} className="text-caption text-muted-foreground">
            {note}
          </p>
        ))}
        <p className="text-caption text-muted-foreground">{copy.marketsHelp}</p>
      </div>
    </div>
  )
}
