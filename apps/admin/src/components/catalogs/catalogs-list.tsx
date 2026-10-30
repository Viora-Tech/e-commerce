'use client'

import type { CatalogSummary } from '@commerce/core'
import { permissions } from '@commerce/core/permissions'
import { PackageOpen, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import EmptyState from '@/components/layout/empty-state'
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

/**
 * Markets › Catalogs (Shopify's): each catalog with the markets that sell from it, what it sells
 * ("All products · 307") and its price change.
 */
export default function CatalogsList({ catalogs }: CatalogsListProps) {
  // Hooks
  const copy = useCopy(catalogsContent)
  const { hasPermission } = usePermissions()

  // Render logic
  const createButton = hasPermission(permissions.SETTINGS_MANAGE) ? (
    <Button nativeButton={false} render={<Link href={routes.catalogs.new()} />}>
      <Plus aria-hidden="true" />
      {copy.create}
    </Button>
  ) : null

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
        <SettingsTable
          heading={copy.listTitle}
          columns={[
            { label: copy.columns.name },
            { label: copy.columns.products, className: 'hidden sm:table-cell' },
            { label: copy.columns.prices, className: 'hidden md:table-cell' },
            { label: copy.columns.status, center: true },
          ]}
        >
          {catalogs.map((c) => (
            <CatalogRow key={c.id} catalog={c} />
          ))}
        </SettingsTable>
      )}
    </ProoflyListPage>
  )
}
