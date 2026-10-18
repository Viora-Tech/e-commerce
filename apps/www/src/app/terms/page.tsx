import LegalPage from '@/components/legal/legal-page'
import { termsDoc } from '@/data/legal/terms'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: termsDoc.title,
  description: termsDoc.description,
  path: '/terms',
})

export default function Page() {
  return <LegalPage doc={termsDoc} />
}
