import { siteConfig } from '@commerce/config/site'
import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from '@/lib/og-image'

// Built once at `next build`: the site is a static export.
export const dynamic = 'force-static'

export const alt = `${siteConfig.brand.name}: AI e-commerce platform for Indian brands`
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function Image() {
  return ogImage({
    title: 'AI e-commerce for Indian brands',
    line: 'UPI-first checkout, GST invoices, Indian couriers, your Shopify theme and a Hindi admin.',
  })
}
