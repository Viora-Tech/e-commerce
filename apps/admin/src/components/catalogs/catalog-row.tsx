'use client'

import type { CatalogSummary } from '@commerce/core'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import { catalogsContent } from '@/data/catalogs'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { percentLabel } from './catalog-form-state'

type CatalogRowProps = {
  catalog: CatalogSummary
}

/** One catalog: its name and markets, what it sells, its price change and status. */
export default function CatalogRow({ catalog: c }: CatalogRowProps) {
  // Hooks
  const copy = useCopy(catalogsContent)

  // Render logic
  const markets = c.markets.map((m) => m.name).join(', ') || copy.noMarkets
  const products =
    c.scope === 'all' ? copy.allProducts(c.productCount) : copy.productCount(c.productCount)
  const prices = [
    c.priceAdjustmentBp === 0
      ? copy.noAdjustment
      : copy.adjustment(percentLabel(c.priceAdjustmentBp)),
    c.fixedPriceCount > 0 ? copy.fixedPrices(c.fixedPriceCount) : '',
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <SettingsTableRow>
      <SettingsTableCell>
        <div className="flex min-w-0 flex-col">
          <Link
            href={routes.catalogs.detail(c.id)}
            className="truncate font-semibold text-ink-strong hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {c.name}
          </Link>
          <span className="truncate text-caption text-muted-foreground">{markets}</span>
        </div>
      </SettingsTableCell>
      <SettingsTableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">
        {products}
      </SettingsTableCell>
      <SettingsTableCell className="hidden text-muted-foreground md:table-cell">
        {prices}
      </SettingsTableCell>
      <SettingsTableCell center>
        <StatusChip tone={c.status === 'active' ? 'success' : 'neutral'}>
          {copy.statuses[c.status]}
        </StatusChip>
      </SettingsTableCell>
    </SettingsTableRow>
  )
}
