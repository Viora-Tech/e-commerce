'use client'

import type { NavigationSettings } from '@commerce/core/navigation'
import { Plus } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { type MenuListItem, menusContent } from '@/data/menus'
import CreateMenuDialog from './create-menu-dialog'
import MenuActions from './menu-actions'
import StorefrontNavigationSummary from './storefront-navigation-summary'

type NavigationListProps = {
  initialMenus: MenuListItem[]
  initialSettings: NavigationSettings
}

const copy = menusContent

/** Where the storefront uses this menu's handle, for the table's usage badges. */
function placementsFor(handle: string, settings: NavigationSettings): ('header' | 'footer')[] {
  const placements: ('header' | 'footer')[] = []
  if (settings.main === handle) placements.push('header')
  if (settings.footer.includes(handle)) placements.push('footer')
  return placements
}

export default function NavigationList({ initialMenus, initialSettings }: NavigationListProps) {
  // Hooks
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [settings, setSettings] = useState(initialSettings)

  // Event handlers
  const handleSettingsSaved = (next: NavigationSettings) => {
    setSettings(next)
    router.refresh()
  }

  // Render logic
  const shown = initialMenus.filter(
    (m) => !query || m.title.toLowerCase().includes(query.toLowerCase()),
  )

  const columns: ResourceColumnSpec<MenuListItem>[] = [
    {
      id: 'title',
      title: copy.columns.title,
      sortValue: (m) => m.title,
      hideable: false,
      render: (m) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-ink-strong">{m.title}</span>
          {placementsFor(m.handle, settings).map((placement) => (
            <Badge key={placement} variant="secondary">
              {copy.usage[placement]}
            </Badge>
          ))}
        </span>
      ),
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
          {new Date(m.updatedAt).toLocaleString('en-IN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          })}
        </span>
      ),
    },
  ]

  return (
    <PageBody>
      <PageHeader
        title={copy.title}
        actions={
          <>
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
          </>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
        <div className="order-2 lg:order-1">
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
        </div>
        <div className="order-1 lg:order-2">
          <StorefrontNavigationSummary
            menus={initialMenus}
            settings={settings}
            onSaved={handleSettingsSaved}
          />
        </div>
      </div>
      <CreateMenuDialog open={creating} onOpenChange={setCreating} />
    </PageBody>
  )
}
