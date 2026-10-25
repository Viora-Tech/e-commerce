'use client'

import { permissions } from '@commerce/core/permissions'
import { ChevronRight, Database, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import SettingsTable from '@/components/settings/settings-table'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
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

/** Stretches a row's one link over the whole row, so the row is the click target. */
const ROW_LINK =
  'font-semibold text-ink-strong after:absolute after:inset-0 after:content-[""] focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset'

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
      <SettingsTable
        heading={page.overview.fieldsHeading}
        description={page.overview.fieldsBody}
        columns={[
          { label: page.overview.columns.kind },
          { label: page.overview.columns.fields, className: 'w-40' },
        ]}
        actions
      >
        {CUSTOM_DATA_OWNERS.map((o) => {
          const Icon = o.icon
          const n = data?.counts[o.owner]
          return (
            <SettingsTableRow key={o.owner} className="relative cursor-pointer hover:bg-muted/50">
              <SettingsTableCell className="py-2.5">
                <div className="flex items-center gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-muted/40 text-muted-foreground [&_svg]:size-4">
                    <Icon aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <Link href={routes.settings.customDataOwner(o.slug)} className={ROW_LINK}>
                      {copy.tabs[o.tab].label}
                    </Link>
                    <span className="truncate text-caption text-muted-foreground">
                      {page.ownerHints[o.owner]}
                    </span>
                  </span>
                </div>
              </SettingsTableCell>
              <SettingsTableCell className="w-40 text-muted-foreground tabular-nums">
                {n === undefined ? <Skeleton className="h-4 w-16" /> : page.overview.count(n)}
              </SettingsTableCell>
              <SettingsTableCell className="w-16 text-right text-muted-foreground">
                <ChevronRight aria-hidden="true" className="ml-auto size-4" />
              </SettingsTableCell>
            </SettingsTableRow>
          )
        })}
      </SettingsTable>

      <section id="content-types" className="scroll-mt-6">
        <SettingsTable
          heading={copy.metaobjects.heading}
          description={copy.metaobjects.body}
          columns={[
            { label: page.overview.typesColumns.type },
            { label: page.overview.typesColumns.entries, className: 'w-40' },
          ]}
          actions
          after={
            data && data.metaobjects.length === 0 ? (
              <div className="border-line border-t">
                <EmptyState
                  icon={Database}
                  heading={page.overview.typesEmptyHeading}
                  body={page.overview.typesEmptyBody}
                  action={addType}
                />
              </div>
            ) : null
          }
          footer={data && data.metaobjects.length > 0 ? addType : null}
        >
          {data === null ? (
            <SettingsTableRow>
              <SettingsTableCell>
                <Skeleton className="h-4 w-40" />
              </SettingsTableCell>
              <SettingsTableCell />
              <SettingsTableCell />
            </SettingsTableRow>
          ) : (
            data.metaobjects.map((d) => (
              <SettingsTableRow key={d.id} className="relative cursor-pointer hover:bg-muted/50">
                <SettingsTableCell className="py-2.5">
                  <span className="flex min-w-0 flex-col">
                    <Link href={`${entriesPath(d.type)}/definition`} className={ROW_LINK}>
                      {d.name}
                    </Link>
                    <span className="truncate font-mono text-caption text-muted-foreground">
                      {d.type}
                    </span>
                  </span>
                </SettingsTableCell>
                <SettingsTableCell className="w-40 text-muted-foreground tabular-nums">
                  {copy.metaobjects.entries(d.entries)}
                </SettingsTableCell>
                <SettingsTableCell className="w-16 text-right text-muted-foreground">
                  <ChevronRight aria-hidden="true" className="ml-auto size-4" />
                </SettingsTableCell>
              </SettingsTableRow>
            ))
          )}
        </SettingsTable>
      </section>
    </div>
  )
}
