import LegalPage from '@/components/legal/legal-page'
import { refundsDoc } from '@/data/legal/refunds'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: refundsDoc.title,
  description: refundsDoc.description,
  path: '/refunds',
})

export default function Page() {
  return <LegalPage doc={refundsDoc} />
}
