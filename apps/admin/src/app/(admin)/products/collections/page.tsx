import type { Metadata } from 'next'
import { collectionsListContent } from '@/data/collections'
import { appRouter, call, serverContext } from '@/lib/api'
import CollectionsPage from './collections-page'

export const metadata: Metadata = { title: collectionsListContent.title }

export default async function Page() {
  const context = await serverContext()
  const collections = await call(appRouter.collections.list, undefined, { context })

  return <CollectionsPage initial={{ collections }} />
}
