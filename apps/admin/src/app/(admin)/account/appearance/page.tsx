import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import AppearanceSettings from '@/components/settings/appearance-settings'
import { PRODUCT_LAYOUT_COOKIE, parseProductLayout } from '@/lib/product-layout'

export const metadata: Metadata = { title: 'Appearance' }

export default async function Page() {
  const productLayout = parseProductLayout((await cookies()).get(PRODUCT_LAYOUT_COOKIE)?.value)
  return <AppearanceSettings productLayout={productLayout} />
}
