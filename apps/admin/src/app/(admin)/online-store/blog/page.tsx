import type { Metadata } from 'next'
import { permanentRedirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Blog posts' }

/** Blog posts moved under Content, as in Shopify; keep old links working. */
export default function Page() {
  permanentRedirect('/content/blog-posts')
}
