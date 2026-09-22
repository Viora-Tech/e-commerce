import type { Metadata } from 'next'
import { collectionsListContent } from '@/data/collections'
import { appRouter, call, serverContext } from '@/lib/api'
import CollectionsPage from './collections-page'

export const metadata: Metadata = { title: collectionsListContent.title }

export default async function Page() {
  const context = await serverContext()
  const [collections, stats, products] = await Promise.all([
    call(appRouter.collections.list, undefined, { context }),
    call(appRouter.collections.stats, undefined, { context }),
    call(appRouter.collections.products, { page: 1, perPage: 10 }, { context }),
  ])

  return <CollectionsPage initial={{ collections, stats, products }} />
}
