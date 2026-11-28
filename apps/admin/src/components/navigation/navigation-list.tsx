'use client'

import { siteConfig } from '@commerce/config/site'
import type { NavigationSettings } from '@commerce/core/navigation'
import { ArrowLeftRight, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import ResourceTable from '@/components/table/resource-table'
import { type MenuListItem, menusContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import CreateMenuDialog from './create-menu-dialog'
import MenuActions from './menu-actions'
import { menuColumns } from './menu-columns'
import { placementsFor, type ThemeMenuPlacements } from './placements'
import StorefrontNavigationDialog from './storefront-navigation-dialog'

type NavigationListProps = {
  initialMenus: MenuListItem[]
  initialSettings: NavigationSettings
  themePlacements: ThemeMenuPlacements
}

export default function NavigationList({
  initialMenus,
  initialSettings,
  themePlacements,
}: NavigationListProps) {
  // Hooks
  const copy = useCopy(menusContent)
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [creating, setCreating] = useState(false)
  const [assigning, setAssigning] = useState(false)
  const [settings, setSettings] = useState(initialSettings)

  // Helpers
  const usedIn = (m: MenuListItem) => placementsFor(m.handle, settings, themePlacements)

  // Event handlers
  const handleSettingsSaved = (next: NavigationSettings) => {
    setSettings(next)
    router.refresh()
  }

  const handleQuery = (next: string) => {
    setQuery(next)
    setPage(1)
  }

  const handlePerPage = (next: number) => {
    setPerPage(next)
    setPage(1)
  }

  // Render logic
  const needle = query.trim().toLowerCase()
  const matching = initialMenus.filter(
    (m) => !needle || m.title.toLowerCase().includes(needle) || m.handle.includes(needle),
  )
  const shown = matching.slice((page - 1) * perPage, page * perPage)
  const where = copy.usedInJoin([
    ...new Set(initialMenus.flatMap((m) => usedIn(m)).map((p) => copy.where[p])),
  ])

  const columns = menuColumns(copy, usedIn)

  const addButton = (
    <Button type="button" onClick={() => setCreating(true)}>
      <Plus strokeWidth={1.6} />
      {copy.add}
    </Button>
  )

  return (
    <ProoflyListPage
      title={copy.title}
      summary={copy.summary(initialMenus.length, where)}
      actions={
        <>
          {initialMenus.length > 0 ? (
            <Button type="button" variant="outline" onClick={() => setAssigning(true)}>
              {copy.headerFooter}
            </Button>
          ) : null}
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={routes.content.redirects()} />}
          >
            <ArrowLeftRight aria-hidden="true" />
            {copy.redirects}
          </Button>
          {addButton}
        </>
      }
    >
      <ResourceTable
        fill
        resourceName={copy.resource}
        columns={columns}
        items={shown}
        getId={(m) => m.id}
        href={(m) => routes.content.menu(m.id)}
        rowActions={(m) => <MenuActions menu={m} />}
        query={query}
        onQueryChange={handleQuery}
        page={page}
        perPage={perPage}
        total={matching.length}
        onPageChange={setPage}
        onPerPageChange={handlePerPage}
        selectable={false}
        empty={{
          heading: copy.empty.heading,
          body: copy.empty.body,
          action: addButton,
        }}
      />
      <StorefrontNavigationDialog
        open={assigning}
        onOpenChange={setAssigning}
        menus={initialMenus}
        settings={settings}
        onSaved={handleSettingsSaved}
      />
      <CreateMenuDialog open={creating} onOpenChange={setCreating} />
    </ProoflyListPage>
  )
}
