import { siteConfig } from '@commerce/config/site'
import { GUIDES, guideBySlug } from '@/data/guides'
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from '@/lib/og-image'

// Built once at `next build`: the site is a static export.
export const dynamic = 'force-static'

export const alt = `A ${siteConfig.brand.name} guide for Indian online sellers`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const guide = guideBySlug(slug)
  return ogImage({ eyebrow: 'Guide', title: guide?.title ?? 'Guides' })
}
