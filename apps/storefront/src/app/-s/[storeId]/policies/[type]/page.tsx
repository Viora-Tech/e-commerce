import { isPolicyType, policyPath, publishedPolicy } from '@commerce/core'
import { parseRichText, richTextToPlainText } from '@commerce/richtext'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PolicyPage from '@/components/policies/policy-page'
import { marketCanonical, metaDescription, NO_INDEX } from '@/lib/seo'
import { storeShareImages } from '@/lib/share-image'
import { inStore } from '@/lib/store-context'
import { isThemePreview } from '@/lib/template-render'

type Params = { params: Promise<{ storeId: string; type: string }> }

async function findPolicy(storeId: string, type: string) {
  if (!isPolicyType(type)) return null
  return inStore(storeId, (tx) => publishedPolicy({ tx, storeId }, type))
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { storeId, type } = await params
  const found = await findPolicy(storeId, type)
  if (!found || !isPolicyType(type)) return {}
  const title = found.seoTitle || found.title
  const description = metaDescription(
    found.seoDescription || richTextToPlainText(parseRichText(found.body)),
  )
  const url = await marketCanonical(policyPath(type))
  const images = await storeShareImages(storeId)
  return {
    title,
    description,
    alternates: { canonical: url },
    ...(found.publishedAt ? {} : { robots: NO_INDEX }),
    openGraph: { type: 'website', url, title, description, images },
  }
}

/** `/policies/<type>`: a store policy from Settings → Policies, rendered on the server. */
export default async function StorePolicyPage({ params }: Params) {
  const { storeId, type } = await params
  const found = await findPolicy(storeId, type)
  // Hidden policies 404 for shoppers; the owner's theme preview can still see them.
  if (!found || (!found.publishedAt && !(await isThemePreview(storeId)))) notFound()
  return <PolicyPage title={found.title} body={found.body} updatedAt={found.updatedAt} />
}
