import { permanentRedirect } from 'next/navigation'

/** Blog posts moved under Content, as in Shopify; keep old links working. */
export default function Page() {
  permanentRedirect('/content/blog-posts')
}
