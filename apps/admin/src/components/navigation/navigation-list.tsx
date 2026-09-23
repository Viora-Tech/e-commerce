'use client'

import type { NavigationSettings } from '@commerce/core/navigation'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import PageBody from '@/components/layout/page-body'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { type MenuListItem, menusContent } from '@/data/menus'
import CreateMenuDialog from './create-menu-dialog'
import MenuActions from './menu-actions'
import StorefrontNavigationCard from './storefront-navigation-card'

type NavigationListProps = {
  initialMenus: MenuListItem[]
  initialSettings: NavigationSettings
}

const copy = menusContent

const columns: ResourceColumnSpec<MenuListItem>[] = [
  {
    id: 'title',
    title: copy.columns.title,
    sortValue: (m) => m.title,
    hideable: false,
    render: (m) => <span className="font-bold text-ink-strong">{m.title}</span>,
  },
  {
    id: 'handle',
    title: copy.columns.handle,
    sortValue: (m) => m.handle,
    render: (m) => <span className="text-muted-foreground">/menus/{m.handle}</span>,
  },
  {
    id: 'items',
    title: copy.columns.items,
    sortValue: (m) => m.itemCount,
    render: (m) => <span className="tabular-nums">{copy.itemCount(m.itemCount)}</span>,
  },
  {
    id: 'updated',
    title: copy.columns.updated,
    sortValue: (m) => new Date(m.updatedAt),
    align: 'end',
    render: (m) => (
      <span className="text-muted-foreground tabular-nums">
        {new Date(m.updatedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
      </span>
    ),
  },
]

export default function NavigationList({ initialMenus, initialSettings }: NavigationListProps) {
  // Hooks
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)

  // Render logic
  const shown = initialMenus.filter(
    (m) => !query || m.title.toLowerCase().includes(query.toLowerCase()),
  )

  return (
    <PageBody>
      <StorefrontNavigationCard
        menus={initialMenus}
        settings={initialSettings}
        onSaved={() => router.refresh()}
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href="/content/menus/redirects" />}
        >
          {copy.redirects}
        </Button>
        <Button type="button" onClick={() => setCreating(true)}>
          <Plus />
          {copy.add}
        </Button>
      </div>
      <ResourceTable
        resourceName={{ singular: 'menu', plural: 'menus' }}
        columns={columns}
        items={shown}
        getId={(m) => m.id}
        href={(m) => `/content/menus/${m.id}`}
        rowActions={(m) => <MenuActions menu={m} />}
        query={query}
        onQueryChange={setQuery}
        page={1}
        perPage={100}
        total={shown.length}
        onPageChange={() => {}}
        selectable={false}
        empty={{
          heading: copy.empty.heading,
          body: copy.empty.body,
          action: (
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus />
              {copy.add}
            </Button>
          ),
        }}
      />
      <CreateMenuDialog open={creating} onOpenChange={setCreating} />
    </PageBody>
  )
}
