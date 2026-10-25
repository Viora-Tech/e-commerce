import LegalPage from '@/components/legal/legal-page'
import { shippingDoc } from '@/data/legal/shipping'
import { pageMetadata } from '@/lib/metadata'

export const metadata = pageMetadata({
  title: shippingDoc.title,
  description: shippingDoc.description,
  path: '/shipping',
})

export default function Page() {
  return <LegalPage doc={shippingDoc} />
}
