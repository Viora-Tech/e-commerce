import type { Metadata } from 'next'
import LinksPage from '@/components/growth/links/links-page'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: 'Links' }

export default async function Page() {
  return <LinksPage storefrontOrigin={await storefrontOrigin()} />
}
