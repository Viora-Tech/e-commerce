import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import CollectionForm from '@/components/collections/collection-form'
import type { LoadedCollection } from '@/components/collections/form-state'
import { collectionFormContent } from '@/data/collections'
import { appRouter, call, serverContext } from '@/lib/api'
import { storefrontOrigin } from '@/lib/storefront-origin'

/** One read of the collection per server render: the tab title and the page share it. */
const loadCollection = cache(async (id: string) =>
  call(appRouter.collections.get, { id }, { context: await serverContext() }),
)

type Props = { params: Promise<{ id: string }> }

/** The collection's name in the tab ("Mice"), not "Edit collection" (audit #70). */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const collection = await loadCollection(id).catch(() => null)
  return { title: collection?.title || collectionFormContent.editTitle }
}

export default async function Page({ params }: Props) {
  const { id } = await params
  const collection = await loadCollection(id)
  if (!collection) notFound()

  return (
    <CollectionForm
      collection={collection as unknown as LoadedCollection}
      storefrontOrigin={await storefrontOrigin()}
    />
  )
}
