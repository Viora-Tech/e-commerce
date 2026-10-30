'use client'

import { permissions } from '@commerce/core/permissions'
import { Database, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import SettingsLinkRow from '@/components/settings/settings-link-row'
import SettingsList from '@/components/settings/settings-list'
import { CUSTOM_DATA_OWNERS, customDataOverviewContent } from '@/data/custom-data'
import { customDataContent } from '@/data/metaobjects'
import { SETTINGS_BACK } from '@/data/settings'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { type DefinitionSummary, entriesPath } from './form-state'

type Loaded = {
  /** How many extra fields each kind of record has, by owner type. */
  counts: Record<string, number>
  metaobjects: DefinitionSummary[]
}

async function load(): Promise<Loaded> {
  const [lists, metaobjects] = await Promise.all([
    Promise.all(
      CUSTOM_DATA_OWNERS.map((o) => api.metaobjects.metafieldDefinitions({ ownerType: o.owner })),
    ),
    api.metaobjects.definitions(),
  ])
  const counts = Object.fromEntries(
    CUSTOM_DATA_OWNERS.map((o, i) => [o.owner, lists[i]?.length ?? 0]),
  )
  return { counts, metaobjects }
}

/**
 * Settings → Custom data (after Shopify's "Metafields and metaobjects"): one list of every kind
 * of record that takes extra fields, with how many each has, each opening its own page; then
 * the content types with their entry counts.
 */
export default function CustomDataSettings() {
  // Hooks
  const copy = useCopy(customDataContent)
  const page = useCopy(customDataOverviewContent)
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

  // Render logic
  const canManage = hasPermission(permissions.CONTENT_MANAGE_TYPES)
  const addType = canManage ? (
    <Button
      variant="outline"
      nativeButton={false}
      render={<Link href={routes.content.newContentType()} />}
    >
      <Plus />
      {copy.metaobjects.add}
    </Button>
  ) : null

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.intro} back={SETTINGS_BACK} />
      <SettingsList heading={page.overview.fieldsHeading} description={page.overview.fieldsBody}>
        {CUSTOM_DATA_OWNERS.map((o) => {
          const Icon = o.icon
          const n = data?.counts[o.owner]
          return (
            <li key={o.owner}>
              <SettingsLinkRow
                href={routes.settings.customDataOwner(o.slug)}
                leading={
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-muted/40 text-muted-foreground [&_svg]:size-4">
                    <Icon aria-hidden="true" />
                  </span>
                }
                title={copy.tabs[o.tab].label}
                description={page.ownerHints[o.owner]}
                value={
                  n === undefined ? (
                    <Skeleton className="h-4 w-16" />
                  ) : (
                    <span className="tabular-nums">{page.overview.count(n)}</span>
                  )
                }
              />
            </li>
          )
        })}
      </SettingsList>

      <section id="content-types" className="scroll-mt-6">
        <SettingsList
          heading={copy.metaobjects.heading}
          description={copy.metaobjects.body}
          after={
            data && data.metaobjects.length === 0 ? (
              <EmptyState
                icon={Database}
                heading={page.overview.typesEmptyHeading}
                body={page.overview.typesEmptyBody}
                action={addType}
              />
            ) : null
          }
          footer={data && data.metaobjects.length > 0 ? addType : null}
        >
          {data === null ? (
            <li className="px-5 py-4">
              <Skeleton className="h-4 w-40" />
            </li>
          ) : (
            data.metaobjects.map((d) => (
              <li key={d.id}>
                <SettingsLinkRow
                  href={`${entriesPath(d.type)}/definition`}
                  title={d.name}
                  description={<span className="font-mono">{d.type}</span>}
                  value={
                    <span className="tabular-nums">{copy.metaobjects.entries(d.entries)}</span>
                  }
                />
              </li>
            ))
          )}
        </SettingsList>
      </section>
    </div>
  )
}
