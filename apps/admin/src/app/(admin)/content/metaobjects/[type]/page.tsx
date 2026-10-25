import { siteConfig } from '@commerce/config/site'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import EntriesPage from '@/components/metaobjects/entries-page'
import { metaobjectListContent } from '@/data/metaobjects'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getCopy(metaobjectListContent)).heading }
}

type Props = { params: Promise<{ type: string }> }

export default async function Page({ params }: Props) {
  const { type } = await params
  const context = await serverContext()
  const definition = await call(appRouter.metaobjects.definition, { type }, { context }).catch(
    () => null,
  )
  if (!definition) notFound()
  const initial = await call(
    appRouter.metaobjects.entries,
    { definitionId: definition.id, page: 1, perPage: siteConfig.ui.rowsPerPage.default },
    { context },
  )
  return (
    <EntriesPage
      definition={definition}
      initial={initial}
      initialPerPage={siteConfig.ui.rowsPerPage.default}
    />
  )
}
