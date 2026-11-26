import type { Metadata } from 'next'
import CreativesGrid from '@/components/affiliate-portal/creatives-grid'
import PageHeading from '@/components/affiliate-portal/page-heading'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { requireAffiliate } from '@/lib/affiliate-portal'
import { loadCreatives } from '@/lib/portal-data'

type MarketingPageProps = { params: Promise<{ storeId: string }> }

const copy = affiliatePortalContent.marketing

export const metadata: Metadata = { title: copy.metaTitle }

/** Marketing tools: the images, videos and captions the store gives its affiliates. */
export default async function MarketingPage({ params }: MarketingPageProps) {
  // Hooks
  const { storeId } = await params
  const { affiliate } = await requireAffiliate(storeId)
  const creatives = await loadCreatives(storeId, affiliate)

  // Render logic
  return (
    <>
      <PageHeading description={copy.help} />
      <CreativesGrid creatives={creatives} />
    </>
  )
}
