'use client'

import type { PreorderOverview } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { PackageOpen, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import EmptyState from '@/components/layout/empty-state'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import StatStrip from '@/components/layout/stat-strip'
import SettingsTable from '@/components/settings/settings-table'
import { preordersContent } from '@/data/preorders'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'
import PreorderCampaignRow from './preorder-campaign-row'
import PreorderProductRow from './preorder-product-row'

type PreordersOverviewProps = {
  overview: PreorderOverview
}

/**
 * Products › Pre-orders (#141), after Essential Pre-Order's home: the last 30 days, every
 * product taking pre-orders with its limit bar, and every campaign with its orders and revenue.
 */
export default function PreordersOverview({ overview }: PreordersOverviewProps) {
  // Hooks
  const copy = useCopy(preordersContent)
  const { hasPermission } = usePermissions()

  // Render logic
  const createButton = hasPermission(permissions.PRODUCTS_WRITE) ? (
    <Button nativeButton={false} render={<Link href={routes.products.newPreorderCampaign()} />}>
      <Plus aria-hidden="true" />
      {copy.create}
    </Button>
  ) : null
  const { last30 } = overview

  return (
    <ProoflyListPage
      title={copy.title}
      summary={copy.intro}
      actions={createButton}
      stats={
        <StatStrip
          tiles={[
            {
              id: 'orders',
              label: copy.stats.orders,
              value: String(last30.orderCount),
              note: copy.stats.last30,
            },
            {
              id: 'revenue',
              label: copy.stats.revenue,
              value: formatPaise(last30.revenuePaise),
              note: copy.stats.last30,
            },
            {
              id: 'units',
              label: copy.stats.units,
              value: String(last30.units),
              note: copy.stats.last30,
            },
          ]}
        />
      }
    >
      {overview.campaigns.length === 0 ? (
        <EmptyState
          variant="page"
          icon={PackageOpen}
          heading={copy.campaigns.empty.heading}
          body={copy.campaigns.empty.body}
          action={createButton}
        />
      ) : (
        <SettingsTable
          heading={copy.campaigns.heading}
          description={copy.campaigns.description}
          columns={[
            { label: copy.campaigns.columns.name },
            { label: copy.campaigns.columns.products, className: 'hidden sm:table-cell' },
            { label: copy.campaigns.columns.orders, className: 'hidden md:table-cell' },
            { label: copy.campaigns.columns.revenue, className: 'hidden md:table-cell' },
            { label: copy.campaigns.columns.status, center: true },
          ]}
        >
          {overview.campaigns.map((c) => (
            <PreorderCampaignRow key={c.id} campaign={c} />
          ))}
        </SettingsTable>
      )}

      <SettingsTable
        heading={copy.products.heading}
        description={copy.products.description}
        columns={[
          { label: copy.products.columns.product },
          { label: copy.products.columns.campaign, className: 'hidden md:table-cell' },
          { label: copy.products.columns.orders, className: 'hidden sm:table-cell' },
          { label: copy.products.columns.limit },
          { label: copy.products.columns.status, center: true },
        ]}
        after={
          overview.products.length === 0 ? (
            <EmptyState variant="plain" size="md" body={copy.products.empty} />
          ) : undefined
        }
      >
        {overview.products.map((p) => (
          <PreorderProductRow key={p.id} product={p} />
        ))}
      </SettingsTable>
    </ProoflyListPage>
  )
}
