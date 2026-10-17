import LegalPage from '@/components/legal/legal-page'
import { privacyDoc } from '@/data/legal/privacy'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: privacyDoc.title,
  description: privacyDoc.description,
  path: '/privacy',
})

export default function Page() {
  return <LegalPage doc={privacyDoc} />
}
