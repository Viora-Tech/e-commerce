import type { Metadata } from 'next'
import CollectionForm from '@/components/collections/collection-form'
import { collectionFormContent } from '@/data/collections'

export const metadata: Metadata = { title: collectionFormContent.newTitle }

export default function Page() {
  return <CollectionForm collection={null} />
}
