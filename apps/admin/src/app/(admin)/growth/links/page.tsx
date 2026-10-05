import type { Metadata } from 'next'
import LinksBuilder from '@/components/growth/links-builder'
import { storefrontOrigin } from '@/lib/storefront-origin'

export const metadata: Metadata = { title: 'Links' }

export default async function Page() {
  return <LinksBuilder storefrontOrigin={await storefrontOrigin()} />
}
