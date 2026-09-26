import { loadEnv } from '@commerce/config'
import type { Metadata } from 'next'
import LinksBuilder from '@/components/growth/links-builder'

export const metadata: Metadata = { title: 'Links' }

export default function Page() {
  return <LinksBuilder storefrontOrigin={loadEnv(process.env).STOREFRONT_URL} />
}
