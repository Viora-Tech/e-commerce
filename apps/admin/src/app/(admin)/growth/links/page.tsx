import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { routes } from '@/lib/routes'

export const metadata: Metadata = { title: 'Tracking links' }

/** Tracking links moved to a tab of Campaigns, as in Shopify. */
export default function Page() {
  redirect(routes.growth.trackingLinks())
}
