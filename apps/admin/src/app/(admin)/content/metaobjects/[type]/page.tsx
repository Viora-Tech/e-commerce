import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import EntriesPage from '@/components/metaobjects/entries-page'
import { metaobjectListContent } from '@/data/metaobjects'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'
import { LIST_PER_PAGE } from '@/lib/list-query'

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
    { definitionId: definition.id, page: 1, perPage: LIST_PER_PAGE },
    { context },
  )
  return <EntriesPage definition={definition} initial={initial} />
}
