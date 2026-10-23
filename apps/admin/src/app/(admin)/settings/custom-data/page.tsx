import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import CustomDataSettings from '@/components/metaobjects/custom-data-settings'
import { CUSTOM_DATA_OWNERS } from '@/data/custom-data'
import { customDataContent } from '@/data/metaobjects'
import type { SearchParams } from '@/lib/list-query'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Custom data' }

type Props = { searchParams: Promise<SearchParams> }

/** Old links (`?tab=products`) from the tabbed version open that kind of record's own page. */
export default async function Page({ searchParams }: Props) {
  const raw = (await searchParams).tab
  const tab = Array.isArray(raw) ? raw[0] : raw
  const owner = CUSTOM_DATA_OWNERS.find((o) => customDataContent.tabs[o.tab].id === tab)
  if (owner) redirect(routes.settings.customDataOwner(owner.slug))
  if (tab === customDataContent.tabs.metaobjects.id)
    redirect(`${routes.settings.customData()}#content-types`)
  return <CustomDataSettings />
}
