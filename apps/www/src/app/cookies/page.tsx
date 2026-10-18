import LegalPage from '@/components/legal/legal-page'
import { cookiesDoc } from '@/data/legal/cookies'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: cookiesDoc.title,
  description: cookiesDoc.description,
  path: '/cookies',
})

export default function Page() {
  return <LegalPage doc={cookiesDoc} />
}
