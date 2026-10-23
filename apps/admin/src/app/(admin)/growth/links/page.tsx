import { redirect } from 'next/navigation'
import { routes } from '@/lib/routes'

/** Tracking links moved to a tab of Campaigns, as in Shopify. */
export default function Page() {
  redirect(routes.growth.trackingLinks())
}
