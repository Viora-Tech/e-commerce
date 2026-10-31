'use client'

import type { CatalogSummary } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { PackageOpen, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import PillTabs from '@/components/layout/pill-tabs'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import SettingsTable from '@/components/settings/settings-table'
import { catalogsContent } from '@/data/catalogs'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { routes } from '@/lib/routes'
import CatalogRow from './catalog-row'

type CatalogsListProps = {
  catalogs: CatalogSummary[]
}

type StatusTab = 'all' | CatalogSummary['status']

const TABS: StatusTab[] = ['all', 'active', 'draft']

/**
 * Markets › Catalogs, laid out as Shopify's: All / Active / Draft tabs over one table with the
 * markets each catalog is assigned to, its fixed prices, its overall adjustment and its products.
 */
export default function CatalogsList({ catalogs }: CatalogsListProps) {
  // Hooks
  const copy = useCopy(catalogsContent)
  const { hasPermission } = usePermissions()
  const [tab, setTab] = useState<StatusTab>('all')

  // Helpers
  const countOf = (t: StatusTab) =>
    t === 'all' ? catalogs.length : catalogs.filter((c) => c.status === t).length

  // Render logic
  const createButton = hasPermission(permissions.SETTINGS_MANAGE) ? (
    <Button nativeButton={false} render={<Link href={routes.catalogs.new()} />}>
      <Plus aria-hidden="true" />
      {copy.create}
    </Button>
  ) : null
  const shown = tab === 'all' ? catalogs : catalogs.filter((c) => c.status === tab)

  return (
    <ProoflyListPage title={copy.title} summary={copy.intro} actions={createButton}>
      {catalogs.length === 0 ? (
        <EmptyState
          variant="page"
          icon={PackageOpen}
          heading={copy.empty.heading}
          body={copy.empty.body}
          action={createButton}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <PillTabs
            tabs={TABS.map((t) => ({ value: t, label: copy.tabs[t], count: countOf(t) }))}
            value={tab}
            onChange={setTab}
          />
          <SettingsTable
            columns={[
              { label: copy.columns.name },
              { label: copy.columns.status },
              { label: copy.columns.markets, className: 'hidden sm:table-cell' },
              { label: copy.columns.overrides, className: 'hidden lg:table-cell' },
              { label: copy.columns.adjustment, className: 'hidden md:table-cell' },
              { label: copy.columns.products, className: 'text-right' },
            ]}
          >
            {shown.map((c) => (
              <CatalogRow key={c.id} catalog={c} />
            ))}
          </SettingsTable>
          {shown.length === 0 ? (
            <p className="text-center text-body text-muted-foreground">{copy.noneInTab}</p>
          ) : null}
        </div>
      )}
    </ProoflyListPage>
  )
}
