import LegalPage from '@/components/legal/legal-page'
import { acceptableUseDoc } from '@/data/legal/acceptable-use'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: acceptableUseDoc.title,
  description: acceptableUseDoc.description,
  path: '/acceptable-use',
})

export default function Page() {
  return <LegalPage doc={acceptableUseDoc} />
}
