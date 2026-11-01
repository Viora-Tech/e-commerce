'use client'

import type { CatalogSummary } from '@commerce/core'
import { Globe } from '@commerce/ui/icons'
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

/** One catalog: title, status, the markets it is assigned to, fixed prices, adjustment, products. */
export default function CatalogRow({ catalog: c }: CatalogRowProps) {
  // Hooks
  const copy = useCopy(catalogsContent)

  // Render logic
  const markets = c.markets.map((m) => m.name).join(', ')

  return (
    <SettingsTableRow>
      <SettingsTableCell>
        <Link
          href={routes.catalogs.detail(c.id)}
          className="truncate font-semibold text-ink-strong hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {c.name}
        </Link>
      </SettingsTableCell>
      <SettingsTableCell>
        <StatusChip tone={c.status === 'active' ? 'success' : 'neutral'}>
          {copy.statuses[c.status]}
        </StatusChip>
      </SettingsTableCell>
      <SettingsTableCell className="hidden text-muted-foreground sm:table-cell">
        {markets ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <Globe className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{markets}</span>
          </span>
        ) : (
          copy.noMarkets
        )}
      </SettingsTableCell>
      <SettingsTableCell className="hidden tabular-nums text-muted-foreground lg:table-cell">
        {c.fixedPriceCount > 0 ? c.fixedPriceCount : ''}
      </SettingsTableCell>
      <SettingsTableCell className="hidden tabular-nums text-muted-foreground md:table-cell">
        {c.priceAdjustmentBp === 0 ? copy.noAdjustment : percentLabel(c.priceAdjustmentBp)}
      </SettingsTableCell>
      <SettingsTableCell className="text-right tabular-nums">{c.productCount}</SettingsTableCell>
    </SettingsTableRow>
  )
}
