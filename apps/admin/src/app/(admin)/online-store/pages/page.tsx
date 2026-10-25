import type { Metadata } from 'next'
import PagesList from '@/components/online-store/pages-list'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: 'Pages' }

export default async function Page() {
  return <PagesList storefrontOrigin={await storefrontOrigin()} />
}
