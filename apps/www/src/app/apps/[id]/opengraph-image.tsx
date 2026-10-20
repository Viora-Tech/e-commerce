import { siteConfig } from '@commerce/config/site'
import { STORE_APPS } from '@/data/apps'
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from '@/lib/og-image'

// Built once at `next build`: the site is a static export.
export const dynamic = 'force-static'

export const alt = `A ${siteConfig.brand.name} App Store app`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export function generateStaticParams() {
  return STORE_APPS.map((app) => ({ id: app.id }))
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const app = STORE_APPS.find((a) => a.id === id)
  return ogImage({ eyebrow: 'App Store', title: app?.name ?? 'App Store', line: app?.blurb })
}
