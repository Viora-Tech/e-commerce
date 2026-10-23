import LegalPage from '@/components/legal/legal-page'
import { dataDeletionDoc } from '@/data/legal/data-deletion'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: dataDeletionDoc.title,
  description: dataDeletionDoc.description,
  path: '/data-deletion',
})

export default function Page() {
  return <LegalPage doc={dataDeletionDoc} />
}
