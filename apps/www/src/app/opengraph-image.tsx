import { OG_CONTENT_TYPE, OG_SIZE, ogImage } from '@/lib/og-image'

export const alt = 'Koomerce: AI e-commerce platform for Indian brands'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

export default function Image() {
  return ogImage({
    title: 'AI e-commerce for Indian brands',
    line: 'UPI-first checkout, GST invoices, Indian couriers, your Shopify theme and a Hindi admin.',
  })
}
