'use client'

import { permissions } from '@commerce/core/permissions'
import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import SectionTabs from '@/components/settings/section-tabs'
import SettingsPageHeader from '@/components/settings/settings-page-header'
import SettingsSection from '@/components/settings/settings-section'
import { customDataContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { type DefinitionSummary, entriesPath } from './form-state'
import type { MetafieldDefinitionRow } from './metafield-definition-dialog'
import MetafieldDefinitionsCard from './metafield-definitions-card'

type Loaded = {
  product: MetafieldDefinitionRow[]
  collection: MetafieldDefinitionRow[]
  metaobjects: DefinitionSummary[]
}

async function load(): Promise<Loaded> {
  const [product, collection, metaobjects] = await Promise.all([
    api.metaobjects.metafieldDefinitions({ ownerType: 'product' }),
    api.metaobjects.metafieldDefinitions({ ownerType: 'collection' }),
    api.metaobjects.definitions(),
  ])
  return { product, collection, metaobjects }
}

/** Settings → Custom data: product and collection metafields, and metaobject definitions. */
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
  const tabs = [copy.tabs.products, copy.tabs.collections, copy.tabs.metaobjects]
  const canManage = hasPermission(permissions.SETTINGS_MANAGE)
  const targets = (data?.metaobjects ?? []).map((d) => ({ id: d.id, name: d.name }))

  return (
    <div className="flex flex-col gap-4">
      <SettingsPageHeader title={copy.title} subtitle={copy.intro} />
      <SectionTabs tabs={tabs}>
        <SettingsSection id={copy.tabs.products.id}>
          <MetafieldDefinitionsCard
            ownerType="product"
            definitions={data?.product ?? null}
            targets={targets}
            canManage={canManage}
            onChanged={reload}
          />
        </SettingsSection>
        <SettingsSection id={copy.tabs.collections.id}>
          <MetafieldDefinitionsCard
            ownerType="collection"
            definitions={data?.collection ?? null}
            targets={targets}
            canManage={canManage}
            onChanged={reload}
          />
        </SettingsSection>
        <SettingsSection id={copy.tabs.metaobjects.id}>
          <Card>
            <CardHeader>
              <CardTitle>{copy.metaobjects.heading}</CardTitle>
              <CardDescription>{copy.metaobjects.body}</CardDescription>
              <CardAction>
                <Button
                  variant="outline"
                  render={<Link href={routes.content.newContentType()} />}
                  nativeButton={false}
                >
                  <Plus />
                  {copy.metaobjects.add}
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {data && data.metaobjects.length === 0 ? (
                <p className="rounded-md border border-dashed border-line px-4 py-8 text-center text-body text-muted-foreground">
                  {copy.metaobjects.empty}
                </p>
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
            </CardContent>
          </Card>
        </SettingsSection>
      </SectionTabs>
    </div>
  )
}
