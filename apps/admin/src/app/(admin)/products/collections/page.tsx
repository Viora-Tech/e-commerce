import type { Metadata } from 'next'
import { collectionsListContent } from '@/data/collections'
import { appRouter, call, serverContext } from '@/lib/api'
import { storefrontOrigin } from '@/lib/storefront-origin'
import CollectionsPage from './collections-page'

export const metadata: Metadata = { title: collectionsListContent.title }

export default async function Page() {
  const context = await serverContext()
  const [collections, origin] = await Promise.all([
    call(appRouter.collections.list, undefined, { context }),
    storefrontOrigin(),
  ])

  return <CollectionsPage initial={{ collections, storefrontOrigin: origin }} />
}
