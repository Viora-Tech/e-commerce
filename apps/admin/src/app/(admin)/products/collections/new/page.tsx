import type { Metadata } from 'next'
import CollectionForm from '@/components/collections/collection-form'
import { collectionFormContent } from '@/data/collections'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: collectionFormContent.newTitle }

export default async function Page() {
  return <CollectionForm collection={null} storefrontOrigin={await storefrontOrigin()} />
}
