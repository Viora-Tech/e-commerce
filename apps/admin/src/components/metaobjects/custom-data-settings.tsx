'use client'

import { METAFIELD_OWNER_TYPES, type MetafieldOwnerType } from '@commerce/core/metaobjects'
import { permissions } from '@commerce/core/permissions'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import SectionTabs from '@/components/settings/section-tabs'
import SettingsSection from '@/components/settings/settings-section'
import { customDataContent } from '@/data/metaobjects'
import { SETTINGS_BACK } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { type DefinitionSummary, entriesPath } from './form-state'
import type { MetafieldDefinitionRow } from './metafield-definition-dialog'
import MetafieldDefinitionsCard from './metafield-definitions-card'
import MetafieldsCard from './metafields-card'

type Loaded = {
  fields: Record<MetafieldOwnerType, MetafieldDefinitionRow[]>
  metaobjects: DefinitionSummary[]
}

type Tabs = (typeof customDataContent)['tabs']

/** Each owner's tab, in the order the page shows them. */
const OWNER_TABS: { owner: MetafieldOwnerType; tab: keyof Tabs }[] = [
  { owner: 'product', tab: 'products' },
  { owner: 'variant', tab: 'variants' },
  { owner: 'collection', tab: 'collections' },
  { owner: 'customer', tab: 'customers' },
  { owner: 'order', tab: 'orders' },
  { owner: 'page', tab: 'pages' },
  { owner: 'article', tab: 'articles' },
  { owner: 'shop', tab: 'shop' },
]

async function load(): Promise<Loaded> {
  const [lists, metaobjects] = await Promise.all([
    Promise.all(
      METAFIELD_OWNER_TYPES.map((ownerType) => api.metaobjects.metafieldDefinitions({ ownerType })),
    ),
    api.metaobjects.definitions(),
  ])
  const fields = Object.fromEntries(
    METAFIELD_OWNER_TYPES.map((ownerType, i) => [ownerType, lists[i] ?? []]),
  ) as Loaded['fields']
  return { fields, metaobjects }
}

/**
 * Settings → Custom data: extra fields for every kind of record (and the store's own values),
 * and the content types.
 */
export default function CustomDataSettings() {
  // Hooks
  const copy = useCopy(customDataContent)
  const { hasPermission } = usePermissions()
  const [data, setData] = useState<Loaded | null>(null)

  useEffect(() => {
    let live = true
    load()
      .then((d) => live && setData(d))
      .catch(() => live && toast.error(copy.loadFailed))
    return () => {
      live = false
    }
  }, [copy.loadFailed])

  // Helpers
  const reload = () => {
    load()
      .then(setData)
      .catch(() => toast.error(copy.loadFailed))
  }

  // Render logic
  const tabs = [...OWNER_TABS.map((t) => copy.tabs[t.tab]), copy.tabs.metaobjects]
  const canManage = hasPermission(permissions.CONTENT_MANAGE_TYPES)
  const targets = (data?.metaobjects ?? []).map((d) => ({ id: d.id, name: d.name }))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.intro} back={SETTINGS_BACK} />
      <SectionTabs tabs={tabs}>
        {OWNER_TABS.map(({ owner, tab }) => (
          <SettingsSection key={owner} id={copy.tabs[tab].id} className="flex flex-col gap-4">
            <MetafieldDefinitionsCard
              ownerType={owner}
              definitions={data?.fields[owner] ?? null}
              targets={targets}
              canManage={canManage}
              onChanged={reload}
            />
            {owner === 'shop' && data && data.fields.shop.length > 0 ? (
              <MetafieldsCard
                key={data.fields.shop.length}
                ownerType="shop"
                ownerId={null}
                title={copy.shopValues}
              />
            ) : null}
          </SettingsSection>
        ))}
        <SettingsSection id={copy.tabs.metaobjects.id}>
          <DataCard
            title={copy.metaobjects.heading}
            subtitle={copy.metaobjects.body}
            action={
              <Button
                variant="outline"
                render={<Link href={routes.content.newContentType()} />}
                nativeButton={false}
              >
                <Plus />
                {copy.metaobjects.add}
              </Button>
            }
          >
            {data && data.metaobjects.length === 0 ? (
              <EmptyState variant="dashed" size="md" body={copy.metaobjects.empty} />
            ) : (
              <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
                {(data?.metaobjects ?? []).map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`${entriesPath(d.type)}/definition`}
                      className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted"
                    >
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-body-strong">{d.name}</span>
                        <span className="truncate font-mono text-caption text-muted-foreground">
                          {d.type}
                        </span>
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {copy.metaobjects.entries(d.entries)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </DataCard>
        </SettingsSection>
      </SectionTabs>
    </div>
  )
}
