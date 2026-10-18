'use client'

import { siteConfig } from '@commerce/config/site'
import type { NavigationSettings } from '@commerce/core/navigation'
import { ArrowLeftRight, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import StatusChip from '@/components/layout/status-chip'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { type MenuListItem, menusContent } from '@/data/menus'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import CreateMenuDialog from './create-menu-dialog'
import MenuActions from './menu-actions'
import { placementsFor } from './placements'
import StorefrontNavigationSheet from './storefront-navigation-sheet'

type NavigationListProps = {
  initialMenus: MenuListItem[]
  initialSettings: NavigationSettings
}

export default function NavigationList({ initialMenus, initialSettings }: NavigationListProps) {
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
  const usedIn = (m: MenuListItem) => placementsFor(m.handle, settings)

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

  const columns: ResourceColumnSpec<MenuListItem>[] = [
    {
      id: 'title',
      title: copy.columns.title,
      sortValue: (m) => m.title,
      hideable: false,
      render: (m) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-ink-strong">{m.title}</span>
          <span className="truncate text-caption text-muted-foreground">{m.handle}</span>
        </span>
      ),
    },
    {
      id: 'items',
      title: copy.columns.items,
      sortValue: (m) => m.itemCount,
      render: (m) => <span className="tabular-nums">{copy.itemCount(m.itemCount)}</span>,
    },
    {
      id: 'usedIn',
      title: copy.columns.usedIn,
      render: (m) => {
        const placements = usedIn(m)
        return placements.length > 0 ? (
          placements.map((p) => copy.usage[p]).join(', ')
        ) : (
          <span className="text-muted-foreground">{copy.notUsed}</span>
        )
      },
    },
    {
      id: 'status',
      title: copy.columns.status,
      render: (m) => (
        <StatusChip tone={usedIn(m).length > 0 ? 'success' : 'neutral'}>
          {usedIn(m).length > 0 ? copy.status.active : copy.status.unused}
        </StatusChip>
      ),
    },
  ]

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
      <StorefrontNavigationSheet
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
