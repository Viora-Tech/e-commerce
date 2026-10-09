import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import CollectionForm from '@/components/collections/collection-form'
import type { LoadedCollection } from '@/components/collections/form-state'
import { collectionFormContent } from '@/data/collections'
import { appRouter, call, serverContext } from '@/lib/api'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: collectionFormContent.editTitle }

type Props = { params: Promise<{ id: string }> }

export default async function Page({ params }: Props) {
  const { id } = await params
  const context = await serverContext()
  const collection = await call(appRouter.collections.get, { id }, { context })
  if (!collection) notFound()

  return (
    <CollectionForm
      collection={collection as unknown as LoadedCollection}
      storefrontOrigin={await storefrontOrigin()}
    />
  )
}
