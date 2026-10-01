import type { Metadata } from 'next'
import NewContentType from '@/components/metaobjects/new-content-type'
import { newContentTypeContent } from '@/data/metaobjects'
import { getCopy } from '@/lib/copy-server'

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getCopy(newContentTypeContent)).title }
}

export default function Page() {
  return <NewContentType />
}
