'use client'

import type { MetafieldOwnerType } from '@commerce/core/metaobjects'
import { permissions } from '@commerce/core/permissions'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import { customDataOverviewContent } from '@/data/custom-data'
import { customDataContent } from '@/data/metaobjects'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import type { MetafieldDefinitionRow } from './metafield-definition-dialog'
import MetafieldDefinitionsCard from './metafield-definitions-card'
import MetafieldsCard from './metafields-card'

type CustomDataOwnerPageProps = {
  owner: MetafieldOwnerType
  /** The plural label key in `customDataContent.tabs` ("Products", "Blog posts"). */
  tab: keyof (typeof customDataContent)['tabs']
}

type Loaded = {
  fields: MetafieldDefinitionRow[]
  targets: { id: string; name: string }[]
}

async function load(owner: MetafieldOwnerType): Promise<Loaded> {
  const [fields, types] = await Promise.all([
    api.metaobjects.metafieldDefinitions({ ownerType: owner }),
    api.metaobjects.definitions(),
  ])
  return { fields, targets: types.map((d) => ({ id: d.id, name: d.name })) }
}

/**
 * Settings → Custom data → one kind of record: its extra fields (add, edit, reorder, delete),
 * and for the store itself the values under them.
 */
export default function CustomDataOwnerPage({ owner, tab }: CustomDataOwnerPageProps) {
  // Hooks
  const copy = useCopy(customDataContent)
  const page = useCopy(customDataOverviewContent)
  const { hasPermission } = usePermissions()
  const [data, setData] = useState<Loaded | null>(null)

  useEffect(() => {
    let live = true
    load(owner)
      .then((d) => live && setData(d))
      .catch(() => live && toast.error(copy.loadFailed))
    return () => {
      live = false
    }
  }, [owner, copy.loadFailed])

  // Helpers
  const reload = () => {
    load(owner)
      .then(setData)
      .catch(() => toast.error(copy.loadFailed))
  }

  // Render logic
  const canManage = hasPermission(permissions.CONTENT_MANAGE_TYPES)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.tabs[tab].label}
        subtitle={page.ownerHints[owner]}
        back={{ label: page.back, href: routes.settings.customData() }}
      />
      <MetafieldDefinitionsCard
        ownerType={owner}
        definitions={data?.fields ?? null}
        targets={data?.targets ?? []}
        canManage={canManage}
        onChanged={reload}
      />
      {owner === 'shop' && data && data.fields.length > 0 ? (
        <MetafieldsCard
          key={data.fields.length}
          ownerType="shop"
          ownerId={null}
          title={copy.shopValues}
        />
      ) : null}
    </div>
  )
}
